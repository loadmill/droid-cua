export type RailSection = 'new-test' | 'devices';

export type SessionState = 'idle' | 'running' | 'completed' | 'failed';

export interface Project {
  id: string;
  name: string;
  path: string;
  testCount: number;
  activeDeviceId: string | null;
}

export interface Device {
  id: string;
  name: string;
  platform: 'android' | 'ios';
  osVersion: string;
  status: 'connected' | 'pairing' | 'disconnected' | 'error';
  lastSeen: string;
}

export interface DcuaFile {
  id: string;
  projectId: string;
  name: string;
  updatedAt: string;
  content: string;
}

export interface SessionLine {
  id: string;
  kind: 'user' | 'assistant' | 'action' | 'reasoning' | 'warning' | 'muted' | 'plain';
  text: string;
}

export interface TestSession {
  id: string;
  title: string;
  projectId: string;
  state: SessionState;
  startedAt: string;
  lines: SessionLine[];
}

export interface NewTestDraft {
  id: string;
  name: string;
  targetDeviceId: string | null;
  scenario: string;
  assertions: string[];
  generatedDcua: string;
}
