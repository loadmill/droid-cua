import type { LogEvent } from '../../../preload/types';
import type { Pane } from './types';

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

export function logClass(kind: LogEvent['kind']): string {
  if (kind === 'warning') return 'text-amber-700';
  if (kind === 'error') return 'text-rose-700';
  if (kind === 'success') return 'text-emerald-700';
  if (kind === 'reasoning') return 'text-slate-500';
  if (kind === 'action') return 'text-sky-600';
  if (kind === 'assistant') return 'text-slate-700';
  if (kind === 'user') return 'text-slate-900 font-medium';
  if (kind === 'system') return 'text-slate-500';
  if (kind === 'muted') return 'text-slate-500';
  return 'text-slate-700';
}

export function modeLabel(currentPane: Pane): string {
  if (currentPane === 'devices') return 'Device management mode';
  if (currentPane === 'execution') return 'Execution mode';
  if (currentPane === 'editor') return 'Editor mode';
  if (currentPane === 'settings') return 'Settings mode';
  return 'Design mode';
}
