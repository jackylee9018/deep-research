import type { ResearchModelId } from './research-models';

export type ResearchHistoryEntry = {
  id: string;
  query: string;
  mode: 'report' | 'answer';
  model: ResearchModelId;
  createdAt: number;
  completedAt: number;
  preview: string;
  content: string;
};

const HISTORY_KEY = 'deep-research:history';
const MAX_HISTORY = 50;

export function loadResearchHistory(): ResearchHistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ResearchHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveResearchHistory(entries: ResearchHistoryEntry[]) {
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(entries.slice(0, MAX_HISTORY)),
  );
}

export function appendResearchHistory(entry: ResearchHistoryEntry) {
  const existing = loadResearchHistory();
  saveResearchHistory([
    entry,
    ...existing.filter(item => item.id !== entry.id),
  ]);
}

export function removeResearchHistory(id: string) {
  saveResearchHistory(loadResearchHistory().filter(item => item.id !== id));
}

export function makeHistoryPreview(content: string, max = 160) {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) {
    return flat;
  }
  return `${flat.slice(0, max)}…`;
}
