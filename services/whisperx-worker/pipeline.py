"""WhisperX transcription + diarization. Optimized defaults for Apple Silicon (M-series)."""

from __future__ import annotations

import json
import sys
import warnings

warnings.filterwarnings(
    "ignore",
    category=UserWarning,
    module="pyannote.audio.core.io",
)
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch


def _normalize_device(device: str) -> str:
    """WhisperX uses faster-whisper / CTranslate2 — only cpu and cuda are supported."""
    normalized = device.strip().lower()
    if normalized == "cuda":
        if torch.cuda.is_available():
            return "cuda"
        print(
            "Note: WHISPERX_DEVICE=cuda requested but CUDA is unavailable; using cpu.",
            file=sys.stderr,
        )
        return "cpu"
    if normalized in ("mps", "metal"):
        print(
            "Note: WHISPERX_DEVICE=mps is not supported by WhisperX/faster-whisper; using cpu.",
            file=sys.stderr,
        )
        return "cpu"
    if normalized != "cpu":
        print(
            f"Note: unknown WHISPERX_DEVICE={device!r}; using cpu.",
            file=sys.stderr,
        )
    return "cpu"


def resolve_device() -> str:
    forced = os.environ.get("WHISPERX_DEVICE", "").strip().lower()
    if forced:
        return _normalize_device(forced)
    if torch.cuda.is_available():
        return "cuda"
    if os.environ.get("WHISPERX_PREFER_MPS", "").strip() == "1":
        if torch.backends.mps.is_available():
            print(
                "Note: WHISPERX_PREFER_MPS is set but faster-whisper has no MPS backend; using cpu.",
                file=sys.stderr,
            )
    # faster-whisper / pyannote are most stable on CPU for Apple Silicon
    return "cpu"


def resolve_compute_type(device: str) -> str:
    explicit = os.environ.get("WHISPERX_COMPUTE_TYPE", "").strip()
    if explicit:
        if device == "cpu" and explicit == "float16":
            # Common misconfig with WHISPERX_DEVICE=mps + float16 on Mac.
            return "int8"
        return explicit
    if device == "cuda":
        return "float16"
    return "int8"


def _ffmpeg_to_wav(source: Path, target: Path) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-ac",
        "1",
        "-ar",
        "16000",
        str(target),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout or "ffmpeg failed")


def _segment_audio(wav_path: Path, segment_minutes: int) -> list[Path]:
    if segment_minutes <= 0:
        return [wav_path]

    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(wav_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        duration = float((probe.stdout or "0").strip())
    except ValueError:
        duration = 0.0

    if duration <= segment_minutes * 60:
        return [wav_path]

    out_dir = wav_path.parent / "segments"
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = str(out_dir / "part_%03d.wav")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(wav_path),
            "-f",
            "segment",
            "-segment_time",
            str(segment_minutes * 60),
            "-reset_timestamps",
            "1",
            pattern,
        ],
        check=True,
        capture_output=True,
    )
    parts = sorted(out_dir.glob("part_*.wav"))
    return parts if parts else [wav_path]


def resolve_align_language(language: str | None) -> str:
    """WhisperX align models: Cantonese transcribe uses yue, alignment falls back to zh."""
    code = (language or "zh").strip().lower()
    if code == "yue":
        return "zh"
    return code


@dataclass
class TranscribeOptions:
    language: str | None = "zh"
    min_speakers: int | None = None
    max_speakers: int | None = None


HF_DIARIZATION_ACCEPT_URLS = {
    "pyannote/speaker-diarization-3.1": "https://huggingface.co/pyannote/speaker-diarization-3.1",
    "pyannote/speaker-diarization-community-1": "https://huggingface.co/pyannote/speaker-diarization-community-1",
    "pyannote/segmentation-3.0": "https://huggingface.co/pyannote/segmentation-3.0",
}


def _diarization_model_name() -> str:
    return (
        os.environ.get("WHISPERX_DIARIZATION_MODEL", "").strip()
        or "pyannote/speaker-diarization-community-1"
    )


def _hf_diarization_setup_hint(model_name: str) -> str:
    url = HF_DIARIZATION_ACCEPT_URLS.get(
        model_name,
        f"https://huggingface.co/{model_name}",
    )
    extra = ""
    if "speaker-diarization-3.1" in model_name:
        extra = (
            "\nAlso accept: https://huggingface.co/pyannote/segmentation-3.0"
        )
    return (
        f"Cannot download diarization model '{model_name}'.\n"
        f"1) Open {url} and click Agree / Accept user conditions (logged in as token owner).\n"
        f"2) Ensure HF_TOKEN in .env.local is a Read token from https://huggingface.co/settings/tokens .\n"
        f"3) Restart worker: npm run meeting:worker"
        f"{extra}"
    )


def _load_diarization_pipeline(device: str, hf_token: str | None):
    """Load diarization pipeline (WhisperX >=3.3 moved API to whisperx.diarize)."""
    import whisperx

    if not hf_token:
        raise RuntimeError(
            "HF_TOKEN is required for speaker diarization. "
            "Add HF_TOKEN=hf_... to project-root .env.local and restart the worker."
        )

    model_name = _diarization_model_name()

    try:
        if hasattr(whisperx, "DiarizationPipeline"):
            return whisperx.DiarizationPipeline(
                use_auth_token=hf_token,
                device=device,
            )

        from whisperx.diarize import DiarizationPipeline

        return DiarizationPipeline(
            model_name=model_name,
            token=hf_token,
            device=device,
        )
    except Exception as exc:  # noqa: BLE001
        message = str(exc)
        if "Could not download" in message or "gated" in message.lower():
            raise RuntimeError(_hf_diarization_setup_hint(model_name)) from exc
        raise


def transcribe_file(
    source_path: Path,
    options: TranscribeOptions,
    on_progress: callable | None = None,
    on_partial: callable | None = None,
) -> dict[str, Any]:
    import whisperx

    model_name = os.environ.get("WHISPERX_MODEL", "medium").strip() or "medium"
    device = resolve_device()
    compute_type = resolve_compute_type(device)
    segment_minutes = int(os.environ.get("MEETING_SEGMENT_MINUTES", "12") or "12")
    hf_token = os.environ.get("HF_TOKEN", "").strip() or None

    def progress(phase: str, detail: str = "") -> None:
        if on_progress:
            on_progress(phase, detail)

    def publish_partial() -> None:
        if not on_partial:
            return
        partial_duration = (
            max((u["endSec"] for u in all_utterances), default=0.0)
            if all_utterances
            else 0.0
        )
        on_partial(
            {
                "meta": {
                    "durationSec": partial_duration,
                    "language": options.language or "zh",
                    "model": model_name,
                    "device": device,
                    "segmentCount": len(segments),
                },
                "speakers": sorted(speakers_set),
                "utterances": all_utterances,
            },
        )

    progress("preprocessing", "Converting audio to 16kHz mono WAV")

    with tempfile.TemporaryDirectory(prefix="whisperx-") as tmp:
        tmp_dir = Path(tmp)
        wav_path = tmp_dir / "audio.wav"
        _ffmpeg_to_wav(source_path, wav_path)
        segments = _segment_audio(wav_path, segment_minutes)

        progress("loading", f"Loading Whisper model ({model_name}, {device})")
        model = whisperx.load_model(
            model_name,
            device,
            compute_type=compute_type,
            language=options.language,
        )

        align_model = None
        align_metadata = None
        diarize_model = None

        all_utterances: list[dict[str, Any]] = []
        speakers_set: set[str] = set()
        time_offset = 0.0

        for index, segment_path in enumerate(segments):
            progress(
                "transcribing",
                f"Segment {index + 1}/{len(segments)}",
            )
            audio = whisperx.load_audio(str(segment_path))
            result = model.transcribe(
                audio,
                batch_size=int(os.environ.get("WHISPERX_BATCH_SIZE", "8") or "8"),
            )

            progress("aligning", f"Aligning segment {index + 1}/{len(segments)}")
            if align_model is None:
                detected = result.get("language") or options.language or "zh"
                align_model, align_metadata = whisperx.load_align_model(
                    language_code=resolve_align_language(
                        str(detected) if detected else None,
                    ),
                    device=device,
                )
            result = whisperx.align(
                result["segments"],
                align_model,
                align_metadata,
                audio,
                device,
                return_char_alignments=False,
            )

            progress("diarizing", f"Speaker diarization {index + 1}/{len(segments)}")
            if diarize_model is None:
                diarize_model = _load_diarization_pipeline(device, hf_token)

            diarize_kwargs: dict[str, Any] = {}
            if options.min_speakers is not None:
                diarize_kwargs["min_speakers"] = options.min_speakers
            if options.max_speakers is not None:
                diarize_kwargs["max_speakers"] = options.max_speakers

            # whisperx.DiarizationPipeline expects str path or 1-D numpy float32 array.
            diarize_segments = diarize_model(audio, **diarize_kwargs)
            result = whisperx.assign_word_speakers(diarize_segments, result)

            for seg in result.get("segments", []):
                speaker = str(seg.get("speaker") or "SPEAKER_UNKNOWN")
                speakers_set.add(speaker)
                start = float(seg.get("start", 0)) + time_offset
                end = float(seg.get("end", start)) + time_offset
                text = str(seg.get("text", "")).strip()
                if not text:
                    continue
                all_utterances.append(
                    {
                        "id": f"u-{len(all_utterances)}",
                        "speaker": speaker,
                        "startSec": round(start, 3),
                        "endSec": round(end, 3),
                        "text": text,
                    },
                )

            publish_partial()

            if index + 1 < len(segments):
                probe = subprocess.run(
                    [
                        "ffprobe",
                        "-v",
                        "error",
                        "-show_entries",
                        "format=duration",
                        "-of",
                        "default=noprint_wrappers=1:nokey=1",
                        str(segment_path),
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                try:
                    time_offset += float((probe.stdout or "0").strip())
                except ValueError:
                    pass

        duration_sec = (
            max((u["endSec"] for u in all_utterances), default=0.0)
            if all_utterances
            else 0.0
        )

        return {
            "meta": {
                "durationSec": duration_sec,
                "language": options.language or "zh",
                "model": model_name,
                "device": device,
                "segmentCount": len(segments),
            },
            "speakers": sorted(speakers_set),
            "utterances": all_utterances,
        }


def write_transcript_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
