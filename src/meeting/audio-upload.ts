const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
]);

export function isMeetingAudioFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    AUDIO_TYPES.has(file.type) ||
    name.endsWith('.mp3') ||
    name.endsWith('.wav') ||
    name.endsWith('.m4a')
  );
}

export function meetingAudioExtension(fileName: string): string {
  const ext = fileName.toLowerCase().match(/\.(mp3|wav|m4a)$/)?.[0];
  return ext ?? '.mp3';
}
