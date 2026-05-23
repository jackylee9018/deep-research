#!/usr/bin/env bash
# Load HF_TOKEN and other vars from repo-root .env / .env.local, then start uvicorn.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$SCRIPT_DIR"
ROOT="$(cd "$WORKER_DIR/../.." && pwd)"

cd "$WORKER_DIR"

load_env_file() {
  local file="$1"
  local override="$2"
  [[ -f "$file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [[ -z "$line" ]] && continue
    line="${line#export }"
    [[ "$line" == *"="* ]] || continue

    key="${line%%=*}"
    key="$(echo "$key" | xargs)"
    val="${line#*=}"
    val="$(echo "$val" | xargs)"
    val="${val%\"}"
    val="${val#\"}"
    val="${val%\'}"
    val="${val#\'}"

    if [[ "$override" == "1" ]] || [[ -z "${!key:-}" ]]; then
      export "$key=$val"
    fi
  done < "$file"
}

load_env_file "$ROOT/.env" 0
load_env_file "$ROOT/.env.local" 1

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate

pip install -q -r requirements.txt

export WHISPERX_MODEL="${WHISPERX_MODEL:-medium}"
export WHISPERX_DEVICE="${WHISPERX_DEVICE:-cpu}"
export WHISPERX_COMPUTE_TYPE="${WHISPERX_COMPUTE_TYPE:-int8}"

if [[ -z "${HF_TOKEN:-}" ]]; then
  echo ""
  echo "⚠️  HF_TOKEN 未載入。" >&2
  echo "   請在專案根目錄 .env.local 加入：HF_TOKEN=hf_..." >&2
  echo "   （Next.js 的 dev 會讀 .env.local，但 worker 需透過此腳本啟動）" >&2
  echo "" >&2
else
  echo "✓ HF_TOKEN 已從 $ROOT/.env.local 載入"
  echo "  請確認已在 Hugging Face 同意 diarization 模型條款："
  echo "  https://huggingface.co/pyannote/speaker-diarization-community-1"
  echo "  https://huggingface.co/pyannote/segmentation-3.0  （3.1 必須，community 也建議）"
  echo "  （若使用 3.1 模型，另需 https://huggingface.co/pyannote/speaker-diarization-3.1）"
  echo ""
  python3 check_hf_access.py || true
fi

if curl -sf --max-time 2 "http://127.0.0.1:8091/health" >/dev/null 2>&1; then
  echo ""
  echo "✓ WhisperX worker 已在 http://127.0.0.1:8091 運行，無需重複啟動。"
  echo "  驗證：curl http://127.0.0.1:8091/health"
  echo "  若要重啟：lsof -ti :8091 | xargs kill  然後再執行 npm run meeting:worker"
  echo ""
  exit 0
fi

if lsof -nP -iTCP:8091 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⚠️  8091 已被其他程式占用，但 health 檢查失敗。" >&2
  echo "   查看占用：lsof -nP -iTCP:8091 -sTCP:LISTEN" >&2
  echo "   結束後重試：lsof -ti :8091 | xargs kill" >&2
  exit 1
fi

exec uvicorn app:app --host 127.0.0.1 --port 8091
