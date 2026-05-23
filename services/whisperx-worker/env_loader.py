"""Load project-root .env / .env.local into os.environ (worker runs outside Next.js)."""

from __future__ import annotations

import os
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = WORKER_DIR.parents[1]


def _strip_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def _apply_env_file(path: Path, *, override: bool) -> None:
    if not path.is_file():
        return

    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:].strip()
        if '=' not in line:
            continue

        key, _, value = line.partition('=')
        key = key.strip()
        value = _strip_quotes(value.strip())
        if not key:
            continue

        if override or not os.environ.get(key):
            os.environ[key] = value


def load_project_env() -> Path:
    """Load repo-root env files. Returns project root path."""
    _apply_env_file(PROJECT_ROOT / '.env', override=False)
    _apply_env_file(PROJECT_ROOT / '.env.local', override=True)
    return PROJECT_ROOT


def hf_token_configured() -> bool:
    return bool(os.environ.get('HF_TOKEN', '').strip())
