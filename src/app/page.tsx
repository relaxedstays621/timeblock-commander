'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTasks, useBlocks, useAnalytics, triggerSchedule, updateTask, completeBlock, createTask } from '@/hooks/useApi';
import { QuickCapture } from '@/components/QuickCapture';
import { CompanyTag, TaskTypeTag, ScoreBadge, StatusBadge, Modal, Spinner, EmptyState, SectionLabel } from '@/components/ui';
import { COMPANY_DISPLAY, COMPANY_COLORS, TASK_TYPE_DISPLAY, HOURS } from '@/lib/constants';
import type { Company } from '@prisma/client';

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [view, setView] = useState<string>('today');
  const [mobileNav, setMobileNav] = useState(false);
  const [quickCapture, setQuickCapture] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const { tasks, loading: tasksLoading, refresh: refreshTasks } = useTasks();
  const { blocks, loading: blocksLoading, refresh: refreshBlocks } = useBlocks('week');
  const { analytics, loading: analyticsLoading, refresh: refreshAnalytics } = useAnalytics();

  const refreshAll = useCallback(() => {
    refreshTasks();
    refreshBlocks();
    refreshAnalytics();
  }, [refreshTasks, refreshBlocks, refreshAnalytics]);

  const handleSchedule = async (action: 'day' | 'week' | 'reschedule') => {
    await triggerSchedule(action);
    refreshAll();
  };

  const handleUpdateTask = async (id: string, data: any) => {
    await updateTask(id, data);
    refreshAll();
  };

  const handleCompleteBlock = async (blockId: string) => {
    await completeBlock(blockId);
    refreshAll();
  };

  // Derived data
  const todayStr = new Date().toISOString().split('T')[0];
  const todayBlocks = blocks.filter((b: any) => b.date?.split('T')[0] === todayStr).sort((a: any, b: any) => a.startHour - b.startHour);
  const activeTasks = tasks.filter((t: any) => t.status !== 'COMPLETE' && t.status !== 'DROPPED');
  const carryovers = tasks.filter((t: any) => t.carryover);
  const top3 = [...activeTasks].sort((a: any, b: any) => (b.compositeScore || 0) - (a.compositeScore || 0)).slice(0, 3);

  const navItems = [
    { key: 'today', label: 'Today', icon: '◉' },
    { key: 'week', label: 'This Week', icon: '▦' },
    { key: 'queue', label: 'Task Queue', icon: '☰' },
    { key: 'analytics', label: 'Analytics', icon: '◫' },
    { key: 'settings', label: 'Settings', icon: '⚙' },
  ];

  return (
    <div className="min-h-screen bg-surface-0 text-white flex flex-col">
      {/* ─── HEADER ─── */}
      <header className="flex justify-between items-center px-5 py-3 bg-surface-0/95 border-b border-white/[0.06] sticky top-0 z-[100] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button className="text-xl text-white/70 md:hidden" onClick={() => setMobileNav(!mobileNav)}>☰</button>
          <div className="flex items-center gap-2">
            <span className="text-xl text-accent-red">◈</span>
            <span className="text-sm font-bold tracking-[3px]">TIMEBLOCK</span>
          </div>
        </div>
        <button
          className="bg-accent-red text-white px-4 py-2 rounded-lg text-[13px] font-semibold tracking-wide"
          onClick={() => setQuickCapture(true)}
        >
          + Capture
        </button>
      </header>

      <div className="flex flex-1">
        {/* ─── SIDEBAR ─── */}
        <nav className={`w-[260px] bg-surface-1/98 border-r border-white/[0.06] py-4 overflow-y-auto flex-shrink-0 fixed top-[52px] bottom-0 left-0 z-[90] transition-transform duration-300 ${mobileNav ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="px-4 mb-4">
            <SectionLabel>Command Center</SectionLabel>
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-[13px] text-left mb-0.5 transition-all ${
                  view === item.key
                    ? 'bg-accent-red/[0.12] text-accent-red'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
                onClick={() => { setView(item.key); setMobileNav(false); }}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="px-4 mb-4">
            <SectionLabel>Actions</SectionLabel>
            <button className="block w-full text-left px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-md text-[12px] text-white/60 hover:text-white/80 mb-1" onClick={() => handleSchedule('day')}>
              ↻ Schedule Today
            </button>
            <button className="block w-full text-left px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-md text-[12px] text-white/60 hover:text-white/80 mb-1" onClick={() => handleSchedule('week')}>
              ▦ Schedule Week
            </button>
            <button className="block w-full text-left px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-md text-[12px] text-white/60 hover:text-white/80" onClick={() => handleSchedule('reschedule')}>
              ⚡ Reschedule Now
            </button>
          </div>

          {top3.length > 0 && (
            <div className="px-4 mb-4">
              <SectionLabel>Top 3 This Week</SectionLabel>
              {top3.map((t: any, i: number) => (
                <div key={t.id} className="flex items-start gap-2 py-1.5 cursor-pointer" onClick={() => setSelectedTask(t)}>
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                    style={{ background: COMPANY_COLORS[t.company as Company]?.accent }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[12px] text-white/60 leading-snug">{t.title}</span>
                </div>
              ))}
            </div>
          )}

          {analytics && (
            <div className="px-4">
              <SectionLabel>Allocation</SectionLabel>
              {(['APERTURE_ADS', 'RENTALS', 'DIYP', 'PERSONAL'] as Company[]).map((c) => {
                const planned = analytics.byCompany?.[c]?.planned || 0;
                const total = analytics.totals?.planned || 1;
                const pct = Math.round((planned / total) * 100) || 0;
                return (
                  <div key={c} className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] text-white/40 w-20 flex-shrink-0 truncate">{COMPANY_DISPLAY[c]}</span>
                    <div className="flex-1 h-1 bg-white/[0.08] rounded overflow-hidden">
                      <div className="h-full rounded transition-all duration-500" style={{ width: `${pct}%`, background: COMPANY_COLORS[c]?.accent }} />
                    </div>
                    <span className="text-[10px] text-white/30 w-7 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {/* ─── MAIN ─── */}
        <main className="flex-1 md:ml-[260px] p-4 md:p-6 overflow-y-auto min-h-[calc(100vh-52px)]">
          <div className="max-w-[900px] mx-auto">
            {tasksLoading ? (
              <Spinner />
            ) : (
              <>
                {view === 'today' && (
                  <TodayView
                    blocks={todayBlocks}
                    tasks={tasks}
                    top3={top3}
                    carryovers={carryovers}
                    onSelectTask={setSelectedTask}
                    onUpdateTask={handleUpdateTask}
                    onCompleteBlock={handleCompleteBlock}
                    onReschedule={() => handleSchedule('reschedule')}
                  />
                )}
                {view === 'week' && (
                  <WeekView blocks={blocks} tasks={tasks} onSelectTask={setSelectedTask} />
                )}
                {view === 'queue' && (
                  <QueueView tasks={tasks} onSelectTask={setSelectedTask} onUpdateTask={handleUpdateTask} />
                )}
                {view === 'analytics' && (
                  <AnalyticsView analytics={analytics} loading={analyticsLoading} />
                )}
                {view === 'settings' && (
                  <SettingsView />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* ─── MODALS ─── */}
      <QuickCapture open={quickCapture} onClose={() => setQuickCapture(false)} onCreated={refreshAll} />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (data: any) => {
            await handleUpdateTask(selectedTask.id, data);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Mobile overlay */}
      {mobileNav && <div className="fixed inset-0 bg-black/50 z-[80] md:hidden" onClick={() => setMobileNav(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// TODAY VIEW
// ─────────────────────────────────────────────────────────

function TodayView({ blocks, tasks, top3, carryovers, onSelectTask, onUpdateTask, onCompleteBlock, onReschedule }: any) {
  const now = new Date();
  const currentHour = now.getHours();

  return (
    <div>
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
          <p className="text-[13px] text-white/40 mt-1">{blocks.length} blocks · {carryovers.length} carryover</p>
        </div>
        <button className="px-4 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-[13px] text-white/80" onClick={onReschedule}>
          ↻ Reschedule
        </button>
      </div>

      {/* Top 3 Banner */}
      {top3.length > 0 && (
        <div className="mb-6 p-4 bg-accent-red/[0.04] border border-accent-red/[0.15] rounded-xl">
          <div className="text-[11px] font-bold tracking-[1.5px] text-accent-red mb-3">⚡ TOP PRIORITIES</div>
          <div className="flex flex-wrap gap-3">
            {top3.map((t: any, i: number) => (
              <div
                key={t.id}
                className="flex-1 min-w-[220px] px-4 py-3 bg-white/[0.03] rounded-lg cursor-pointer hover:bg-white/[0.05] transition-colors"
                style={{ borderLeft: `3px solid ${COMPANY_COLORS[t.company as Company]?.accent}` }}
                onClick={() => onSelectTask(t)}
              >
                <div className="text-[11px] font-bold text-white/30 mb-1">#{i + 1}</div>
                <div className="text-[14px] font-semibold mb-2">{t.title}</div>
                <div className="flex gap-2 flex-wrap">
                  <CompanyTag company={t.company} />
                  <TaskTypeTag type={t.taskType} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="mb-6">
        {HOURS.map((hour) => {
          const block = blocks.find((b: any) => b.startHour === hour);
          const isPrime = hour >= 8 && hour < 12;
          const isCurrent = hour === currentHour;
          const task = block?.task;

          return (
            <div key={hour} className={`flex gap-4 min-h-[56px] border-b border-white/[0.04] ${isCurrent ? 'bg-accent-red/[0.04]' : ''}`}>
              <div className="w-14 flex items-center justify-end gap-1 flex-shrink-0 pr-2">
                <span className="text-[12px] text-white/30 font-medium tabular-nums">
                  {hour > 12 ? hour - 12 : hour}{hour >= 12 ? 'p' : 'a'}
                </span>
                {isPrime && <span className="text-[8px] text-amber-400">★</span>}
              </div>
              <div className="flex-1 py-1">
                {block ? (
                  <div
                    className="px-3.5 py-2.5 rounded-lg cursor-pointer hover:bg-white/[0.05] transition-colors"
                    style={{
                      borderLeft: `3px solid ${COMPANY_COLORS[block.company as Company]?.accent}`,
                      background: isCurrent ? 'rgba(233,69,96,0.08)' : 'rgba(255,255,255,0.03)',
                    }}
                    onClick={() => task && onSelectTask(task)}
                  >
                    <div className="text-[14px] font-semibold mb-1.5">{block.title}</div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <CompanyTag company={block.company} />
                      <TaskTypeTag type={block.taskType} />
                      <span className="text-[10px] text-white/35">{block.durationMinutes}m</span>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        className="px-2.5 py-1 bg-white/[0.06] border border-white/10 rounded text-[11px] text-white/60 hover:text-emerald-400 hover:border-emerald-400/30"
                        onClick={(e) => { e.stopPropagation(); onCompleteBlock(block.id); }}
                      >
                        ✓ Done
                      </button>
                      <button
                        className="px-2.5 py-1 bg-white/[0.06] border border-white/10 rounded text-[11px] text-white/60 hover:text-amber-400 hover:border-amber-400/30"
                        onClick={(e) => { e.stopPropagation(); task && onUpdateTask(task.id, { status: 'DEFERRED' }); }}
                      >
                        → Defer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-3.5 py-2.5 text-[12px] text-white/[0.12]">Available</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Carryovers */}
      {carryovers.length > 0 && (
        <div className="p-4 bg-amber-400/[0.04] border border-amber-400/[0.15] rounded-xl">
          <div className="text-[11px] font-bold tracking-[1.5px] text-amber-400 mb-3">⚠ CARRYOVER ({carryovers.length})</div>
          {carryovers.map((t: any) => (
            <div key={t.id} className="flex justify-between items-center py-2 border-b border-white/[0.04] last:border-0 cursor-pointer" onClick={() => onSelectTask(t)}>
              <span className="text-[13px] text-white/60">{t.title}</span>
              <CompanyTag company={t.company} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// WEEK VIEW
// ─────────────────────────────────────────────────────────

function WeekView({ blocks, tasks, onSelectTask }: any) {
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i + 1);
    return d;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Week Overview</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dateStr = day.toISOString().split('T')[0];
          const dayBlocks = blocks.filter((b: any) => b.date?.split('T')[0] === dateStr);
          const isToday = dateStr === today.toISOString().split('T')[0];

          return (
            <div key={dateStr} className={`bg-white/[0.02] rounded-lg p-2.5 min-h-[120px] border ${isToday ? 'border-accent-red/30' : 'border-white/[0.05]'}`}>
              <div className="flex justify-between mb-2.5">
                <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className={`text-[13px] font-bold ${isToday ? 'text-accent-red' : 'text-white/60'}`}>{day.getDate()}</span>
              </div>
              {dayBlocks.length > 0 ? dayBlocks.map((b: any) => (
                <div
                  key={b.id}
                  className="px-2 py-1.5 rounded mb-1 bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition-colors"
                  style={{ borderLeft: `2px solid ${COMPANY_COLORS[b.company as Company]?.accent}` }}
                  onClick={() => b.task && onSelectTask(b.task)}
                >
                  <div className="text-[11px] font-semibold leading-snug">{b.title}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{b.startHour > 12 ? b.startHour - 12 : b.startHour}{b.startHour >= 12 ? 'pm' : 'am'}</div>
                </div>
              )) : (
                <div className="text-[11px] text-white/[0.12] text-center py-4">No blocks</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// QUEUE VIEW
// ─────────────────────────────────────────────────────────

function QueueView({ tasks, onSelectTask, onUpdateTask }: any) {
  const [filter, setFilter] = useState('all');

  const filtered = tasks
    .filter((t: any) => {
      if (filter === 'all') return t.status !== 'COMPLETE' && t.status !== 'DROPPED';
      if (filter === 'carryover') return t.carryover;
      if (filter === 'strategic') return t.isStrategic;
      return t.company === filter;
    })
    .sort((a: any, b: any) => (b.compositeScore || 0) - (a.compositeScore || 0));

  const filters = ['all', 'carryover', 'strategic', 'APERTURE_ADS', 'RENTALS', 'DIYP', 'PERSONAL'];

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Task Queue</h1>
        <span className="text-[13px] text-white/40">{filtered.length} tasks</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-all ${
              filter === f
                ? 'bg-accent-red/[0.15] border-accent-red/30 text-accent-red'
                : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/70'
            }`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : COMPANY_DISPLAY[f as Company] || f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No tasks matching filter" />
      ) : (
        <div className="space-y-1.5">
          {filtered.map((task: any) => (
            <div
              key={task.id}
              className="flex justify-between items-center px-4 py-3.5 bg-white/[0.02] rounded-lg cursor-pointer hover:bg-white/[0.04] transition-colors"
              style={{ borderLeft: `3px solid ${COMPANY_COLORS[task.company as Company]?.accent}` }}
              onClick={() => onSelectTask(task)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold mb-1.5 truncate">{task.title}</div>
                <div className="flex gap-2 flex-wrap items-center">
                  <CompanyTag company={task.company} />
                  <TaskTypeTag type={task.taskType} />
                  <ScoreBadge score={task.compositeScore || 0} />
                  {task.carryover && <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">↩ Carry</span>}
                  {task.isStrategic && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">★ Strat</span>}
                </div>
              </div>
              <StatusBadge status={task.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ANALYTICS VIEW
// ─────────────────────────────────────────────────────────

function AnalyticsView({ analytics, loading }: any) {
  if (loading || !analytics) return <Spinner />;

  const companies = ['APERTURE_ADS', 'RENTALS', 'DIYP', 'PERSONAL'] as Company[];
  const types = ['PROMOTION', 'DELIVERING', 'BUILDING'];
  const maxPlanned = Math.max(...companies.map((c) => analytics.byCompany?.[c]?.planned || 0), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Time Allocation Analytics</h1>

      {/* Company bars */}
      <div className="mb-8">
        <h2 className="text-base font-bold mb-4">By Company</h2>
        {companies.map((c) => {
          const planned = analytics.byCompany?.[c]?.planned || 0;
          const completed = analytics.byCompany?.[c]?.completed || 0;
          const pct = Math.round((planned / maxPlanned) * 100);
          return (
            <div key={c} className="flex items-center gap-3 mb-3">
              <span className="text-[12px] text-white/50 w-24 flex-shrink-0">{COMPANY_DISPLAY[c]}</span>
              <div className="flex-1 h-4 bg-white/[0.05] rounded overflow-hidden relative">
                <div className="h-full rounded transition-all duration-500" style={{ width: `${pct}%`, background: COMPANY_COLORS[c]?.accent }} />
              </div>
              <span className="text-[11px] text-white/40 w-20 text-right flex-shrink-0">{Math.round(planned / 60)}h / {Math.round(completed / 60)}h</span>
            </div>
          );
        })}
      </div>

      {/* Type cards */}
      <div className="mb-8">
        <h2 className="text-base font-bold mb-4">By Task Type</h2>
        <div className="grid grid-cols-3 gap-3">
          {types.map((type) => {
            const planned = analytics.byType?.[type]?.planned || 0;
            const total = analytics.totals?.planned || 1;
            const pct = Math.round((planned / total) * 100);
            return (
              <div key={type} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">{TASK_TYPE_DISPLAY[type as keyof typeof TASK_TYPE_DISPLAY]?.icon}</div>
                <div className="text-[12px] font-semibold mb-1">{TASK_TYPE_DISPLAY[type as keyof typeof TASK_TYPE_DISPLAY]?.label}</div>
                <div className="text-xl font-bold">{Math.round(planned / 60)}h</div>
                <div className="text-[11px] text-white/40">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strategic vs Reactive */}
      <div className="mb-8">
        <h2 className="text-base font-bold mb-4">Composition</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-400">{analytics.composition?.strategic || 0}</div>
            <div className="text-[12px] text-white/50 mt-1">Strategic</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-400">{analytics.composition?.reactive || 0}</div>
            <div className="text-[12px] text-white/50 mt-1">Reactive</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-400">{analytics.composition?.carryovers || 0}</div>
            <div className="text-[12px] text-white/50 mt-1">Carryovers</div>
          </div>
        </div>
      </div>

      {/* Balance warnings */}
      {analytics.insights?.balance?.some((b: any) => b.isStarving || b.isDominating) && (
        <div className="p-4 bg-amber-400/[0.06] border border-amber-400/20 rounded-xl text-[13px] leading-relaxed">
          <span className="text-xl mr-2">⚠</span>
          {analytics.insights.balance.filter((b: any) => b.isDominating).map((b: any) => (
            <div key={b.company}><strong>{COMPANY_DISPLAY[b.company as Company]}</strong> is consuming {b.percentage}% of your time</div>
          ))}
          {analytics.insights.balance.filter((b: any) => b.isStarving).map((b: any) => (
            <div key={b.company}><strong>{COMPANY_DISPLAY[b.company as Company]}</strong> only has {b.percentage}% — is this intentional?</div>
          ))}
        </div>
      )}

      {/* Overload */}
      {analytics.insights?.overload?.overloaded && (
        <div className="mt-4 p-4 bg-red-400/[0.06] border border-red-400/20 rounded-xl text-[13px] text-white/70 leading-relaxed">
          <span className="text-xl mr-2">🔥</span>
          {analytics.insights.overload.suggestion}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SETTINGS VIEW
// ─────────────────────────────────────────────────────────

function SettingsView() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Settings & Integration</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="font-bold mb-2">Google Calendar</h3>
          <p className="text-[12px] text-white/40 mb-3">Connect Google Calendars for automatic time block sync.</p>
          <div className="text-[12px] text-amber-400 mb-3"><span className="mr-1.5">●</span>Not connected — Phase 2</div>
          <div className="text-[10px] text-white/20 font-mono mt-2">GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="font-bold mb-2">n8n Automation</h3>
          <p className="text-[12px] text-white/40 mb-3">Connect your n8n instance for workflow automation.</p>
          <div className="text-[12px] text-amber-400 mb-3"><span className="mr-1.5">●</span>Not connected — Phase 3</div>
          <div className="text-[10px] text-white/20 font-mono mt-2">N8N_WEBHOOK_BASE_URL</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="font-bold mb-2">OpenAI Agent</h3>
          <p className="text-[12px] text-white/40 mb-3">Upstream task structuring agent for intake processing.</p>
          <div className="text-[12px] text-amber-400 mb-3"><span className="mr-1.5">●</span>Not connected — Phase 4</div>
          <div className="text-[10px] text-white/20 font-mono mt-2">OPENAI_API_KEY</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="font-bold mb-2">Work Preferences</h3>
          <p className="text-[12px] text-white/40 mb-3">Scheduling rules and constraints.</p>
          <div className="space-y-2 text-[13px] text-white/60">
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span>Prime hours</span><span className="font-semibold text-white">8:00 AM – 12:00 PM</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span>Max daily hours</span><span className="font-semibold text-white">10h</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span>Break between blocks</span><span className="font-semibold text-white">15 min</span></div>
            <div className="flex justify-between py-1.5"><span>Work days</span><span className="font-semibold text-white">Mon–Fri</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// TASK DETAIL MODAL
// ─────────────────────────────────────────────────────────

function TaskDetailModal({ task, onClose, onUpdate }: any) {
  const [status, setStatus] = useState(task.status);
  const statuses = ['BACKLOG', 'QUEUED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETE', 'DEFERRED', 'DROPPED'];

  return (
    <Modal open={true} onClose={onClose} title={task.title}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          ['Company', <CompanyTag key="c" company={task.company} />],
          ['Type', <TaskTypeTag key="t" type={task.taskType} />],
          ['Score', <ScoreBadge key="s" score={task.compositeScore || 0} />],
          ['Priority', `${task.priority}/10`],
          ['Urgency', `${task.urgency}/10`],
          ['Duration', `${task.estimatedMinutes}m`],
          ['Energy', task.energyLevel],
          ['Source', task.source?.replace('_', ' ')],
          ['Strategic', task.isStrategic ? 'Yes ★' : 'No'],
          ['Carryover', task.carryover ? `Yes (×${task.carryoverCount})` : 'No'],
        ].map(([label, value], i) => (
          <div key={i} className="py-2 border-b border-white/[0.04]">
            <span className="block text-[10px] font-bold text-white/30 tracking-wider uppercase mb-1">{label as string}</span>
            <span className="text-[13px]">{value}</span>
          </div>
        ))}
      </div>

      {task.description && (
        <div className="mb-4">
          <span className="block text-[10px] font-bold text-white/30 tracking-wider uppercase mb-1">Description</span>
          <p className="text-[13px] text-white/60 leading-relaxed">{task.description}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-white/30 tracking-wider uppercase mb-1">Status</label>
          <select
            className="w-full px-3 py-2 bg-surface-3 border border-white/10 rounded-md text-[13px]"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <button
          className="w-full py-3 bg-accent-red rounded-lg text-white text-sm font-bold"
          onClick={() => onUpdate({ status })}
        >
          Update Task
        </button>
      </div>
    </Modal>
  );
}
