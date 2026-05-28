# WhisperX Worker（會議轉錄）

本地語音轉文字 + 說話者分段服務，供 deep-research 會議摘要功能呼叫。

## Mac M5（Apple Silicon）建議

1. 安裝 [ffmpeg](https://ffmpeg.org/)：`brew install ffmpeg`（CLI 轉檔用，支援 v8）

   **不要**在 worker 啟動時設定 `DYLD_FALLBACK_LIBRARY_PATH` 指向 `ffmpeg@7`：會與 PyAV（`av` 套件）同時載入兩套 FFmpeg，出現 `objc: Class AVFFrameReceiver is implemented in both ...` 警告。

   本專案轉錄流程用 `ffmpeg` 命令列 + `whisperx.load_audio`，說話者分段用記憶體 waveform，不依賴 torchcodec 解檔。啟動時若看到 pyannote 的 torchcodec 提示，可忽略。
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

6. 併發與排隊（建議）

- 預設會啟用內建 queue，避免多個長音檔同時轉錄互搶資源。
- 可用 `WHISPERX_MAX_CONCURRENT` 控制同時處理數（預設 `1`）：

```bash
# 建議先從 1 開始，穩定後再測 2
WHISPERX_MAX_CONCURRENT=1
```

- `GET /health` 會回傳 `maxConcurrentJobs` 與 `queuedJobs` 供觀察。

### Apple Silicon（M 系列）裝置設定

WhisperX 底層為 **faster-whisper（CTranslate2）**，僅支援 **`cpu`** 與 **`cuda`**，**不支援 `mps`**。

建議在 `.env` / `.env.local`：

```bash
WHISPERX_DEVICE=cpu
WHISPERX_COMPUTE_TYPE=int8
WHISPERX_MODEL=small   # 或 medium，依速度/品質取捨
```

若設成 `WHISPERX_DEVICE=mps`，worker 會自動改為 `cpu` 並在 log 提示。

## API

- `GET /health`
- `POST /transcribe` — multipart `file`，query：`language`, `min_speakers`, `max_speakers`
- `GET /jobs/{id}` — 狀態
- `GET /jobs/{id}/result` — 完成後的 transcript JSON
