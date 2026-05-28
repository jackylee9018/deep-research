import type { MeetingJobStatus } from './meeting-jobs';

export const MEETING_JOB_STATUS_LABELS: Record<MeetingJobStatus, string> = {
  pending: '等待中',
  running: '處理中',
  completed: '已完成',
  failed: '失敗',
};

export const MEETING_PHASES = [
  { id: 'upload', label: '上傳' },
  { id: 'transcribe', label: '轉錄' },
  { id: 'summarize', label: '摘要' },
  { id: 'done', label: '完成' },
] as const;

export function meetingPhaseLabel(phase: string): string {
  const map: Record<string, string> = {
    uploading: '上傳音訊',
    transcribing: '語音轉文字',
    queued: '排隊等待轉錄',
    preprocessing: '音訊前處理',
    loading: '載入模型',
    aligning: '對齊時間軸',
    diarizing: '辨識說話者',
    punctuating: '標點還原',
    summarizing: '生成會議紀要',
    done: '完成',
    failed: '失敗',
  };
  return map[phase] ?? phase;
}

export function meetingPhaseStepIndex(phase: string | null): number {
  if (!phase) {
    return 0;
  }
  if (phase === 'uploading') {
    return 0;
  }
  if (
    phase === 'transcribing' ||
    phase === 'queued' ||
    phase === 'preprocessing' ||
    phase === 'loading' ||
    phase === 'aligning' ||
    phase === 'diarizing' ||
    phase === 'punctuating'
  ) {
    return 1;
  }
  if (phase === 'summarizing') {
    return 2;
  }
  if (phase === 'done') {
    return 3;
  }
  return 0;
}
