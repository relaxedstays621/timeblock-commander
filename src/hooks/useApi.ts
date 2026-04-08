'use client';

import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────
// GENERIC FETCHER
// ─────────────────────────────────────────────────────────

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────

export function useTasks(filters?: Record<string, string>) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(filters || {}).toString();
  const url = `/api/tasks${params ? `?${params}` : ''}`;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<any[]>(url);
      setTasks(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { refresh(); }, [refresh]);

  return { tasks, loading, error, refresh };
}

export async function createTask(data: any) {
  return api<any>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(id: string, data: any) {
  return api<any>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string) {
  return api<any>(`/api/tasks/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────
// BLOCKS
// ─────────────────────────────────────────────────────────

export function useBlocks(range: 'day' | 'week' | 'month' = 'day', date?: string) {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const dateStr = date || new Date().toISOString().split('T')[0];
  const url = `/api/blocks?range=${range}&date=${dateStr}`;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<any[]>(url);
      setBlocks(data);
    } catch (e) {
      console.error('Failed to load blocks:', e);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { refresh(); }, [refresh]);

  return { blocks, loading, refresh };
}

export async function completeBlock(id: string, actualMinutes?: number) {
  return api<any>('/api/blocks', {
    method: 'PATCH',
    body: JSON.stringify({ id, completed: true, actualMinutes }),
  });
}

// ─────────────────────────────────────────────────────────
// SCHEDULE
// ─────────────────────────────────────────────────────────

export async function triggerSchedule(action: 'day' | 'week' | 'reschedule', date?: string) {
  return api<any>('/api/schedule', {
    method: 'POST',
    body: JSON.stringify({ action, date }),
  });
}

// ─────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────

export function useAnalytics(range: 'week' | 'month' = 'week') {
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<any>(`/api/analytics?range=${range}`);
      setAnalytics(data);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { refresh(); }, [refresh]);

  return { analytics, loading, refresh };
}
