import type { LogEvent } from '../../../preload/types';
import type { Pane } from './types';

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

export function logClass(kind: LogEvent['kind']): string {
  if (kind === 'warning') return 'text-amber-700';
  if (kind === 'error') return 'text-red-700';
  if (kind === 'success') return 'text-emerald-700';
  if (kind === 'reasoning') return 'text-violet-700';
  if (kind === 'action') return 'text-indigo-700';
  if (kind === 'muted') return 'text-slate-500';
  return 'text-slate-800';
}

export function modeLabel(currentPane: Pane): string {
  if (currentPane === 'devices') return 'Device management mode';
  if (currentPane === 'execution') return 'Execution mode';
  if (currentPane === 'editor') return 'Editor mode';
  if (currentPane === 'settings') return 'Settings mode';
  return 'Design mode (coming soon)';
}
