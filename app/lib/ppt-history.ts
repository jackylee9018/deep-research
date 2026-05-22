import {
  extractPptJobIdFromDownloadUrl,
  pptPreviewPath,
} from './ppt-job-id';
import type { OutlineDeck } from './ppt-types';
import type { ResearchModelId } from './research-models';

export type PptHistoryEntry = {
  id: string;
  prompt: string;
  outlineTitle: string;
  outline: OutlineDeck;
  model: ResearchModelId;
  slideCount?: number;
  serverJobId: string;
  previewUrl: string;
  downloadUrl?: string;
  createdAt: number;
  completedAt: number;
};

export function resolveHistoryPreviewUrl(entry: PptHistoryEntry): string {
  return entry.previewUrl || pptPreviewPath(entry.serverJobId);
}

export function resolveHistoryServerJobId(entry: PptHistoryEntry): string {
  return (
    entry.serverJobId ??
    extractPptJobIdFromDownloadUrl(entry.downloadUrl) ??
    entry.id
  );
}

const HISTORY_KEY = 'deep-research:ppt-history';
const MAX_HISTORY = 50;

export function loadPptHistory(): PptHistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as PptHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePptHistory(entries: PptHistoryEntry[]) {
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(entries.slice(0, MAX_HISTORY)),
  );
}

export function appendPptHistory(entry: PptHistoryEntry) {
  const existing = loadPptHistory();
  savePptHistory([
    entry,
    ...existing.filter(item => item.id !== entry.id),
  ]);
}

export function removePptHistory(id: string) {
  savePptHistory(loadPptHistory().filter(item => item.id !== id));
}
