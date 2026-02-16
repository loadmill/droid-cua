import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi, LogEvent } from './types';

const api: DesktopApi = {
  workspace: {
    getCurrent: () => ipcRenderer.invoke('workspace:getCurrent')
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    add: () => ipcRenderer.invoke('projects:add'),
    setAlias: (payload) => ipcRenderer.invoke('projects:setAlias', payload),
    open: (payload) => ipcRenderer.invoke('projects:open', payload),
    remove: (payload) => ipcRenderer.invoke('projects:remove', payload)
  },
  tests: {
    list: (payload) => ipcRenderer.invoke('tests:list', payload),
    create: (payload) => ipcRenderer.invoke('tests:create', payload),
    rename: (payload) => ipcRenderer.invoke('tests:rename', payload),
    applyRevision: (payload) => ipcRenderer.invoke('tests:applyRevision', payload),
    read: (payload) => ipcRenderer.invoke('tests:read', payload),
    save: (payload) => ipcRenderer.invoke('tests:save', payload),
    delete: (payload) => ipcRenderer.invoke('tests:delete', payload)
  },
  devices: {
    refresh: (payload) => ipcRenderer.invoke('devices:refresh', payload),
    connect: (payload) => ipcRenderer.invoke('devices:connect', payload),
    getState: () => ipcRenderer.invoke('devices:getState')
  },
  execution: {
    start: (payload) => ipcRenderer.invoke('execution:start', payload),
    stop: (payload) => ipcRenderer.invoke('execution:stop', payload)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (next) => ipcRenderer.invoke('settings:set', next)
  },
  events: {
    onExecutionLog: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: LogEvent) => handler(payload);
      ipcRenderer.on('events:executionLog', listener);
      return () => ipcRenderer.off('events:executionLog', listener);
    },
    onDeviceLog: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: LogEvent) => handler(payload);
      ipcRenderer.on('events:deviceLog', listener);
      return () => ipcRenderer.off('events:deviceLog', listener);
    }
  }
};

contextBridge.exposeInMainWorld('desktopApi', api);
