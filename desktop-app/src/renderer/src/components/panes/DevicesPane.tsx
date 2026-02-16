import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, RefreshCw, Cable } from 'lucide-react';
import type { DeviceOption, LogEvent } from '../../../../preload/types';
import { formatTime, logClass } from '../../app/ui-utils';

interface DevicesPaneProps {
  platform: 'android' | 'ios';
  selectedDeviceName: string;
  deviceOptions: DeviceOption[];
  deviceLogs: LogEvent[];
  isBusy: boolean;
  onSetPlatform: (platform: 'android' | 'ios') => void;
  onSetSelectedDeviceName: (name: string) => void;
  onRefreshDevices: () => Promise<void>;
  onConnect: () => Promise<void>;
  onClearLogs: () => void;
}

export function DevicesPane({
  platform,
  selectedDeviceName,
  deviceOptions,
  deviceLogs,
  isBusy,
  onSetPlatform,
  onSetSelectedDeviceName,
  onRefreshDevices,
  onConnect,
  onClearLogs
}: DevicesPaneProps) {
  return (
    <section className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-3 p-4">
      <div className="rounded-lg border border-slate-300 bg-white p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-semibold">Platform</div>
            <div className="text-[12px] text-slate-500">Choose target runtime</div>
          </div>
          <div className="inline-flex rounded-full border border-slate-300 bg-slate-100 p-1">
            {(['android', 'ios'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  onSetPlatform(value);
                  onSetSelectedDeviceName('');
                }}
                className={`rounded-full px-3 py-1 text-[12px] ${platform === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {value === 'ios' ? 'iOS' : 'Android'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Simulator / Emulator</div>
            <div className="text-[12px] text-slate-500">Select and connect a device</div>
          </div>
          <Select.Root value={selectedDeviceName} onValueChange={onSetSelectedDeviceName}>
            <Select.Trigger className="inline-flex min-w-80 items-center justify-between rounded-full border border-slate-300 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
              <Select.Value placeholder="Select a device" />
              <Select.Icon>
                <ChevronDown size={12} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="z-50 overflow-hidden rounded-md border border-slate-300 bg-white shadow-md">
                <Select.Viewport className="p-1">
                  {deviceOptions.map((device) => (
                    <Select.Item key={device.name} value={device.name} className="relative flex cursor-pointer select-none items-center rounded px-7 py-1.5 text-[12px] text-slate-700 outline-none data-[highlighted]:bg-slate-100">
                      <Select.ItemText>{device.label}</Select.ItemText>
                      <Select.ItemIndicator className="absolute left-2 inline-flex">
                        <Check size={12} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" disabled={isBusy} onClick={() => void onRefreshDevices()} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
            <RefreshCw size={12} />
            Refresh
          </button>
          <button type="button" disabled={isBusy || !selectedDeviceName} onClick={() => void onConnect()} className="inline-flex items-center gap-1 rounded border border-indigo-700 bg-indigo-700 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white disabled:opacity-50">
            <Cable size={12} />
            Connect
          </button>
        </div>
      </div>

      <div className="min-h-0 overflow-auto rounded-lg border border-slate-300 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold">Connection Log</div>
          <button type="button" className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[11px]" onClick={onClearLogs}>
            Clear
          </button>
        </div>
        <div className="space-y-1 font-mono text-[12px]">
          {deviceLogs.length === 0 ? <div className="text-slate-500">No connection events yet.</div> : null}
          {deviceLogs.map((line, idx) => (
            <div key={`${line.ts}-${idx}`} className={logClass(line.kind)}>
              [{formatTime(line.ts)}] {line.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
