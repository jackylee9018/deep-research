'use client';

type PptOutlineActivityBarProps = {
  message: string;
  hint?: string;
  variant?: 'outline' | 'ppt';
};

export function PptOutlineActivityBar({
  message,
  hint,
  variant = 'outline',
}: PptOutlineActivityBarProps) {
  return (
    <div
      className={
        variant === 'ppt'
          ? 'ppt-outline-activity ppt-outline-activity--ppt'
          : 'ppt-outline-activity'
      }
      role="status"
      aria-live="polite"
    >
      <span className="ppt-outline-activity-dot" aria-hidden />
      <span className="ppt-outline-activity-message">{message}</span>
      {hint ? (
        <span className="ppt-outline-activity-hint">{hint}</span>
      ) : null}
    </div>
  );
}
