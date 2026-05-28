"""Local WhisperX HTTP worker for meeting transcription (Mac / GPU)."""

from __future__ import annotations

import warnings

# pyannote may warn that torchcodec cannot decode files; we pass in-memory waveforms instead.
warnings.filterwarnings(
    "ignore",
    category=UserWarning,
    module="pyannote.audio.core.io",
)

import json
import logging
import os
import queue
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
logger = logging.getLogger("whisperx-worker")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"),
    )
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

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
try:
    MAX_CONCURRENT_JOBS = max(1, int(os.environ.get("WHISPERX_MAX_CONCURRENT", "1")))
except ValueError:
    MAX_CONCURRENT_JOBS = 1
_job_queue: queue.Queue[tuple[str, Path, TranscribeOptions]] = queue.Queue()


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
    logger.info("Job %s started: source=%s", job_id, source.name)

    def on_progress(phase: str, detail: str = "") -> None:
        logger.info("Job %s phase=%s detail=%s", job_id, phase, detail or "-")
        with _jobs_lock:
            meta = _read_meta(job_id)
            meta["phase"] = phase
            meta["detail"] = detail
            meta["heartbeatAt"] = datetime.now(timezone.utc).isoformat()
            if phase in JobStatus.__members__:
                meta["status"] = phase
            _write_meta(job_id, meta)

    def on_partial(payload: dict[str, Any]) -> None:
        partial_path = _job_dir(job_id) / "transcript.partial.json"
        write_transcript_json(partial_path, payload)
        with _jobs_lock:
            meta = _read_meta(job_id)
            meta["partialUtteranceCount"] = len(payload.get("utterances", []))
            meta["heartbeatAt"] = datetime.now(timezone.utc).isoformat()
            _write_meta(job_id, meta)

    try:
        on_progress("preprocessing")
        result = transcribe_file(source, options, on_progress=on_progress, on_partial=on_partial)
        transcript_path = _job_dir(job_id) / "transcript.json"
        write_transcript_json(transcript_path, result)
        with _jobs_lock:
            meta = _read_meta(job_id)
            meta["status"] = JobStatus.done.value
            meta["phase"] = "done"
            meta["detail"] = "Transcription complete"
            meta["heartbeatAt"] = datetime.now(timezone.utc).isoformat()
            meta["finishedAt"] = datetime.now(timezone.utc).isoformat()
            _write_meta(job_id, meta)
        logger.info("Job %s completed", job_id)
    except Exception as exc:  # noqa: BLE001
        import traceback

        traceback.print_exc()
        err = str(exc).strip() or repr(exc)
        with _jobs_lock:
            meta = _read_meta(job_id)
            meta["status"] = JobStatus.failed.value
            meta["phase"] = "failed"
            meta["error"] = err
            meta["heartbeatAt"] = datetime.now(timezone.utc).isoformat()
            meta["finishedAt"] = datetime.now(timezone.utc).isoformat()
            _write_meta(job_id, meta)
        logger.exception("Job %s failed: %s", job_id, err)


def _worker_loop() -> None:
    while True:
        job_id, source, options = _job_queue.get()
        logger.info("Dequeued job %s (queued remaining=%s)", job_id, _job_queue.qsize())
        try:
            _run_job(job_id, source, options)
        finally:
            _job_queue.task_done()


for i in range(MAX_CONCURRENT_JOBS):
    worker = threading.Thread(
        target=_worker_loop,
        name=f"whisperx-worker-{i + 1}",
        daemon=True,
    )
    worker.start()


@app.get("/health")
def health() -> dict[str, str | bool | int]:
    return {
        "status": "ok",
        "hfTokenConfigured": hf_token_configured(),
        "maxConcurrentJobs": MAX_CONCURRENT_JOBS,
        "queuedJobs": _job_queue.qsize(),
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
        "heartbeatAt": datetime.now(timezone.utc).isoformat(),
        "language": language,
    }
    _write_meta(job_id, meta)

    options = TranscribeOptions(
        language=language,
        min_speakers=min_speakers,
        max_speakers=max_speakers,
    )
    queued_ahead = _job_queue.qsize()
    if queued_ahead > 0:
        meta["detail"] = f"Queued ({queued_ahead} ahead)"
        _write_meta(job_id, meta)
    _job_queue.put((job_id, source, options))
    logger.info(
        "Accepted job %s file=%s queue_ahead=%s",
        job_id,
        file.filename,
        queued_ahead,
    )
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


@app.get("/jobs/{job_id}/partial-result")
def get_partial_result(job_id: str) -> dict[str, Any]:
    transcript_path = _job_dir(job_id) / "transcript.partial.json"
    if not transcript_path.exists():
        raise HTTPException(status_code=404, detail="Partial transcript missing")
    return json.loads(transcript_path.read_text(encoding="utf-8"))


@app.delete("/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, bool]:
    path = _job_dir(job_id)
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    return {"ok": True}
