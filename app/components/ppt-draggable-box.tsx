'use client';

import { useCallback, useRef, type ReactNode } from 'react';

import type { BoxRect } from '../lib/ppt-types';
import type { SlideBoxRole } from '../lib/ppt-slide-box-role';

type DragMode = 'move' | 'resize';

export function PptDraggableBox({
  rect,
  label,
  boxRole,
  onChange,
  disabled = false,
  children,
}: {
  rect: BoxRect;
  label: string;
  boxRole?: SlideBoxRole;
  onChange: (next: BoxRect) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    origin: BoxRect;
  } | null>(null);

  const clampRect = useCallback((next: BoxRect): BoxRect => {
    const w = Math.min(Math.max(next.w, 8), 100);
    const h = Math.min(Math.max(next.h, 6), 100);
    const x = Math.min(Math.max(next.x, 0), 100 - w);
    const y = Math.min(Math.max(next.y, 0), 100 - h);
    return { x, y, w, h };
  }, []);

  const endSession = useCallback(() => {
    sessionRef.current = null;
  }, []);

  const onPointerDownMove = (e: React.PointerEvent) => {
    if (disabled) {
      return;
    }
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    sessionRef.current = {
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origin: rect,
    };
  };

  const onPointerDownResize = (e: React.PointerEvent) => {
    if (disabled) {
      return;
    }
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    sessionRef.current = {
      mode: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      origin: rect,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const session = sessionRef.current;
    const parent = rootRef.current?.offsetParent?.getBoundingClientRect();
    if (!session || !parent?.width || !parent?.height) {
      return;
    }

    const dxPct = ((e.clientX - session.startX) / parent.width) * 100;
    const dyPct = ((e.clientY - session.startY) / parent.height) * 100;
    const origin = session.origin;

    if (session.mode === 'move') {
      onChange(
        clampRect({
          ...origin,
          x: origin.x + dxPct,
          y: origin.y + dyPct,
        }),
      );
      return;
    }

    onChange(
      clampRect({
        ...origin,
        w: origin.w + dxPct,
        h: origin.h + dyPct,
      }),
    );
  };

  return (
    <div
      ref={rootRef}
      className={`ppt-drag-box${boxRole ? ` ppt-drag-box--${boxRole}` : ''}${disabled ? ' ppt-drag-box--disabled' : ''}`}
      style={{
        left: `${rect.x}%`,
        top: `${rect.y}%`,
        width: `${rect.w}%`,
        height: `${rect.h}%`,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endSession}
      onPointerCancel={endSession}
    >
      {!disabled ? (
        <div
          className="ppt-drag-box-handle"
          title={`拖曳${label}`}
          onPointerDown={onPointerDownMove}
        />
      ) : null}
      <div className="ppt-drag-box-content">{children}</div>
      {!disabled ? (
        <div
          className="ppt-drag-box-resize"
          title={`調整${label}大小`}
          onPointerDown={onPointerDownResize}
        />
      ) : null}
    </div>
  );
}
