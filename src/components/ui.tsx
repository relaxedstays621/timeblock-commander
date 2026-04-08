'use client';

import React, { useEffect, useRef } from 'react';
import { COMPANY_DISPLAY, COMPANY_COLORS, TASK_TYPE_DISPLAY } from '@/lib/constants';
import type { Company, TaskType } from '@prisma/client';

// ─────────────────────────────────────────────────────────
// COMPANY TAG
// ─────────────────────────────────────────────────────────

export function CompanyTag({ company }: { company: Company }) {
  const color = COMPANY_COLORS[company]?.accent || '#666';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide text-white"
      style={{ background: color }}
    >
      {COMPANY_DISPLAY[company] || company}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// TASK TYPE TAG
// ─────────────────────────────────────────────────────────

export function TaskTypeTag({ type }: { type: TaskType | null }) {
  if (!type) return null;
  const info = TASK_TYPE_DISPLAY[type];
  if (!info) return null;
  return (
    <span className="text-[11px] text-white/50">
      {info.icon} {info.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// SCORE BADGE
// ─────────────────────────────────────────────────────────

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-red-400 bg-red-400/10' :
    score >= 60 ? 'text-amber-400 bg-amber-400/10' :
    score >= 40 ? 'text-blue-400 bg-blue-400/10' :
    'text-white/40 bg-white/5';

  return (
    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {score}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  BACKLOG: 'bg-white/5 text-white/40',
  QUEUED: 'bg-blue-500/15 text-blue-400',
  SCHEDULED: 'bg-purple-500/15 text-purple-400',
  IN_PROGRESS: 'bg-amber-500/15 text-amber-400',
  COMPLETE: 'bg-emerald-500/15 text-emerald-400',
  DEFERRED: 'bg-orange-500/15 text-orange-400',
  DROPPED: 'bg-red-500/15 text-red-400',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_STYLES[status] || 'bg-white/5 text-white/40'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className={`bg-surface-2 border border-white/10 rounded-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 text-lg">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// LOADING SPINNER
// ─────────────────────────────────────────────────────────

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-6 h-6 border-2 border-white/10 border-t-accent-red rounded-full animate-spin" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────

export function EmptyState({ message, icon = '◇' }: { message: string; icon?: string }) {
  return (
    <div className="text-center py-12 text-white/30">
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-sm">{message}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[2px] text-white/30 uppercase mb-3">
      {children}
    </div>
  );
}
