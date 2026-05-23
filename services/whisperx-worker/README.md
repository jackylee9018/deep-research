# WhisperX Worker（會議轉錄）

本地語音轉文字 + 說話者分段服務，供 deep-research 會議摘要功能呼叫。

## Mac M5（Apple Silicon）建議

1. 安裝 [ffmpeg](https://ffmpeg.org/)：`brew install ffmpeg`
2. Python 3.10+ 虛擬環境：

```bash
cd services/whisperx-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. **Hugging Face 模型授權（必做）**：登入後分別開啟下列頁面，點 **Agree / Accept user conditions**（須與 `HF_TOKEN` 同一帳號）：

- [pyannote/speaker-diarization-community-1](https://huggingface.co/pyannote/speaker-diarization-community-1)（預設）
- 若設定 `WHISPERX_DIARIZATION_MODEL=pyannote/speaker-diarization-3.1`，另需：
  - [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
  - [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)

建立 Read token，寫入專案根目錄 `.env.local`：

```bash
HF_TOKEN=hf_...
```

4. 啟動（會自動讀取**專案根目錄** `.env` / `.env.local` 的 `HF_TOKEN`）：

```bash
# 在專案根目錄
npm run meeting:worker
```

啟動成功應看到：`✓ HF_TOKEN 已從 .../.env.local 載入`

驗證：

```bash
curl http://127.0.0.1:8091/health
# {"status":"ok","hfTokenConfigured":true}
```

5. Next.js 設定：`WHISPERX_WORKER_URL=http://127.0.0.1:8091`

### 可選：嘗試 MPS

```bash
export WHISPERX_PREFER_MPS=1
export WHISPERX_DEVICE=mps
```

若轉錄失敗，改回 `WHISPERX_DEVICE=cpu`。

## API

- `GET /health`
- `POST /transcribe` — multipart `file`，query：`language`, `min_speakers`, `max_speakers`
- `GET /jobs/{id}` — 狀態
- `GET /jobs/{id}/result` — 完成後的 transcript JSON
