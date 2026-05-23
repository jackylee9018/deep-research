"""Local WhisperX HTTP worker for meeting transcription (Mac / GPU)."""

from __future__ import annotations

import json
import os
import shutil
import threading
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from env_loader import hf_token_configured, load_project_env
from pipeline import TranscribeOptions, transcribe_file, write_transcript_json

load_project_env()

DATA_DIR = Path(
    os.environ.get("MEETING_WORKER_DATA_DIR", "/tmp/whisperx-worker-jobs"),
).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="WhisperX Worker", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class JobStatus(str, Enum):
    queued = "queued"
    preprocessing = "preprocessing"
    transcribing = "transcribing"
    aligning = "aligning"
    diarizing = "diarizing"
    done = "done"
    failed = "failed"


class TranscribeRequest(BaseModel):
    language: str | None = "zh"
    min_speakers: int | None = Field(default=None, ge=1, le=20)
    max_speakers: int | None = Field(default=None, ge=1, le=20)


_jobs_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}


def _job_dir(job_id: str) -> Path:
    return DATA_DIR / job_id


def _read_meta(job_id: str) -> dict[str, Any]:
    meta_path = _job_dir(job_id) / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    return json.loads(meta_path.read_text(encoding="utf-8"))


def _write_meta(job_id: str, payload: dict[str, Any]) -> None:
    path = _job_dir(job_id) / "meta.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _run_job(job_id: str, source: Path, options: TranscribeOptions) -> None:
    def on_progress(phase: str, detail: str = "") -> None:
        with _jobs_lock:
            meta = _read_meta(job_id)
            meta["phase"] = phase
            meta["detail"] = detail
            if phase in JobStatus.__members__:
                meta["status"] = phase
            _write_meta(job_id, meta)

    try:
        on_progress("preprocessing")
        result = transcribe_file(source, options, on_progress=on_progress)
        transcript_path = _job_dir(job_id) / "transcript.json"
        write_transcript_json(transcript_path, result)
        with _jobs_lock:
            meta = _read_meta(job_id)
            meta["status"] = JobStatus.done.value
            meta["phase"] = "done"
            meta["detail"] = "Transcription complete"
            meta["finishedAt"] = datetime.now(timezone.utc).isoformat()
            _write_meta(job_id, meta)
    except Exception as exc:  # noqa: BLE001
        with _jobs_lock:
            meta = _read_meta(job_id)
            meta["status"] = JobStatus.failed.value
            meta["phase"] = "failed"
            meta["error"] = str(exc)
            meta["finishedAt"] = datetime.now(timezone.utc).isoformat()
            _write_meta(job_id, meta)


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "hfTokenConfigured": hf_token_configured(),
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = "zh",
    min_speakers: int | None = None,
    max_speakers: int | None = None,
) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    job_id = str(uuid.uuid4())
    job_path = _job_dir(job_id)
    job_path.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix.lower() or ".mp3"
    source = job_path / f"source{ext}"
    content = await file.read()
    source.write_bytes(content)

    meta = {
        "jobId": job_id,
        "fileName": file.filename,
        "status": JobStatus.queued.value,
        "phase": "queued",
        "detail": "Queued",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "language": language,
    }
    _write_meta(job_id, meta)

    options = TranscribeOptions(
        language=language,
        min_speakers=min_speakers,
        max_speakers=max_speakers,
    )
    thread = threading.Thread(
        target=_run_job,
        args=(job_id, source, options),
        daemon=True,
    )
    thread.start()
    return {"jobId": job_id}


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    return _read_meta(job_id)


@app.get("/jobs/{job_id}/result")
def get_result(job_id: str) -> dict[str, Any]:
    meta = _read_meta(job_id)
    if meta.get("status") != JobStatus.done.value:
        raise HTTPException(status_code=409, detail="Job not complete")
    transcript_path = _job_dir(job_id) / "transcript.json"
    if not transcript_path.exists():
        raise HTTPException(status_code=404, detail="Transcript missing")
    return json.loads(transcript_path.read_text(encoding="utf-8"))


@app.delete("/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, bool]:
    path = _job_dir(job_id)
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    with _jobs_lock:
        _jobs.pop(job_id, None)
    return {"ok": True}
