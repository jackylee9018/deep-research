"""Verify Hugging Face token can download gated pyannote diarization assets."""

from __future__ import annotations

import sys

from env_loader import load_project_env

REQUIRED_MODELS = [
    "pyannote/segmentation-3.0",
    "pyannote/speaker-diarization-community-1",
    "pyannote/speaker-diarization-3.1",
]

ACCEPT_URLS = {
    "pyannote/segmentation-3.0": "https://huggingface.co/pyannote/segmentation-3.0",
    "pyannote/speaker-diarization-community-1": "https://huggingface.co/pyannote/speaker-diarization-community-1",
    "pyannote/speaker-diarization-3.1": "https://huggingface.co/pyannote/speaker-diarization-3.1",
}


def main() -> int:
    load_project_env()
    import os

    from huggingface_hub import hf_hub_download

    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        print("❌ HF_TOKEN 未設定（請寫入專案根目錄 .env.local）")
        return 1

    configured = os.environ.get("WHISPERX_DIARIZATION_MODEL", "").strip()
    if configured:
        models = [configured, "pyannote/segmentation-3.0"]
    else:
        models = ["pyannote/speaker-diarization-community-1"]

    # dedupe preserve order
    seen: set[str] = set()
    to_check: list[str] = []
    for model in models:
        if model not in seen:
            seen.add(model)
            to_check.append(model)

    failed: list[str] = []
    for model in to_check:
        try:
            path = hf_hub_download(model, "config.yaml", token=token)
            print(f"✓ {model} — config.yaml 可下載")
            print(f"  cache: {path}")
        except Exception as exc:  # noqa: BLE001
            failed.append(model)
            print(f"❌ {model} — 無法下載 config.yaml")
            print(f"  {exc}")
            url = ACCEPT_URLS.get(model, f"https://huggingface.co/{model}")
            print(f"  → 請登入 HF 並同意條款: {url}")

    if failed:
        print()
        print("常見原因：")
        print("  1) 只同意了 diarization 模型，未同意 pyannote/segmentation-3.0")
        print("  2) HF_TOKEN 帳號 ≠ 在網頁按 Agree 的帳號")
        print("  3) 同意條款後需重啟 worker")
        return 1

    print()
    print("✓ Hugging Face 模型下載權限正常，可以開始轉錄。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
