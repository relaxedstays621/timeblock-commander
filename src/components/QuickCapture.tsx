'use client';

import { useState, useRef, useEffect } from 'react';
import { Modal, CompanyTag } from '@/components/ui';
import { createTask } from '@/hooks/useApi';
import { COMPANIES, TASK_TYPES } from '@/lib/constants';
import { COMPANY_COLORS, COMPANY_DISPLAY, TASK_TYPE_DISPLAY } from '@/lib/constants';
import type { Company, TaskType } from '@prisma/client';

interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function QuickCapture({ open, onClose, onCreated }: QuickCaptureProps) {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState<Company>('APERTURE_ADS');
  const [taskType, setTaskType] = useState<TaskType>('BUILDING');
  const [urgency, setUrgency] = useState(5);
  const [context, setContext] = useState('');
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const reset = () => {
    setTitle('');
    setCompany('APERTURE_ADS');
    setTaskType('BUILDING');
    setUrgency(5);
    setContext('');
  };

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);

    try {
      await createTask({
        title: title.trim(),
        description: context || undefined,
        company,
        taskType: company === 'PERSONAL' ? undefined : taskType,
        priority: 5,
        urgency,
        estimatedMinutes: duration,
        energyLevel: 'MEDIUM',
        isStrategic: false,
        isReactive: urgency >= 7,
        source: 'QUICK_CAPTURE',
        status: 'BACKLOG',
      });

      reset();
      onCreated();
      onClose();
    } catch (e) {
      console.error('Failed to create task:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="⚡ Quick Capture">
      <div className="space-y-4">
        <input
          ref={inputRef}
          className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.12] rounded-lg text-[15px] font-medium text-white placeholder:text-white/30"
          placeholder="What needs to get done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {/* Company */}
        <div>
          <label className="block text-[11px] font-semibold text-white/40 tracking-wide mb-2">Company</label>
          <div className="flex flex-wrap gap-1.5">
            {COMPANIES.map((c) => (
              <button
                key={c}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-all ${
                  company === c
                    ? 'text-white border-transparent'
                    : 'text-white/50 bg-white/[0.04] border-white/[0.08] hover:border-white/20'
                }`}
                style={company === c ? { background: COMPANY_COLORS[c]?.accent } : {}}
                onClick={() => setCompany(c)}
              >
                {COMPANY_DISPLAY[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Task Type */}
        {company !== 'PERSONAL' && (
          <div>
            <label className="block text-[11px] font-semibold text-white/40 tracking-wide mb-2">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {TASK_TYPES.map((t) => (
                <button
                  key={t}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-all ${
                    taskType === t
                      ? 'bg-accent-red/80 text-white border-transparent'
                      : 'text-white/50 bg-white/[0.04] border-white/[0.08] hover:border-white/20'
                  }`}
                  onClick={() => setTaskType(t)}
                >
                  {TASK_TYPE_DISPLAY[t].icon} {TASK_TYPE_DISPLAY[t].label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Urgency */}
        <div>
          <label className="block text-[11px] font-semibold text-white/40 tracking-wide mb-2">
            Urgency: {urgency}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={urgency}
            onChange={(e) => setUrgency(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-[11px] font-semibold text-white/40 tracking-wide mb-2">Duration</label>
          <div className="flex flex-wrap gap-1.5">
            {[15, 30, 45, 60, 90, 120, 180, 240].map((d) => (
              <button
                key={d}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-all ${
                  duration === d
                    ? 'bg-accent-red/80 text-white border-transparent'
                    : 'text-white/50 bg-white/[0.04] border-white/[0.08] hover:border-white/20'
                }`}
                onClick={() => setDuration(d)}
              >
                {d >= 60 ? `${d / 60}h` : `${d}m`}
              </button>
            ))}
          </div>
        </div>

        {/* Context */}
        <textarea
          className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white placeholder:text-white/25 resize-y font-[inherit]"
          placeholder="Any context? (optional)"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
        />

        {/* Submit */}
        <button
          className="w-full py-3 bg-accent-red rounded-lg text-white text-sm font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={submit}
          disabled={!title.trim() || submitting}
        >
          {submitting ? 'Adding...' : 'Add to Queue →'}
        </button>
      </div>
    </Modal>
  );
}
