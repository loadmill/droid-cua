export type AppSection = 'new-test' | 'devices' | 'settings';

export type AppMode = 'design' | 'editor' | 'execution' | 'devices' | 'settings';

export type LogKind =
  | 'user'
  | 'assistant'
  | 'reasoning'
  | 'action'
  | 'warning'
  | 'info'
  | 'error'
  | 'success'
  | 'system'
  | 'muted';

export type ExecutionEventType =
  | 'run_started'
  | 'instruction_started'
  | 'reasoning'
  | 'assistant_message'
  | 'tool_call'
  | 'screenshot_captured'
  | 'assertion_result'
  | 'retry'
  | 'input_request'
  | 'run_finished'
  | 'error'
  | 'system_message'
  | 'design_started'
  | 'design_status'
  | 'design_waiting_for_input'
  | 'design_user_input'
  | 'design_generated_script'
  | 'design_saved'
  | 'design_error'
  | 'design_finished';

export type ExecutionActionType =
  | 'click'
  | 'double_click'
  | 'drag'
  | 'scroll'
  | 'type'
  | 'keypress'
  | 'wait'
  | 'screenshot'
  | 'move';

export interface WorkspaceInfo {
  rootPath: string;
  testsDir: string;
  workspaceName: string;
}

export interface TestFile {
  name: string;
  filename: string;
  path: string;
  lines: number;
  modified: string;
}

export interface ProjectTestFile extends TestFile {
  folderId: string;
}

export interface ProjectFolder {
  id: string;
  path: string;
  name: string;
  alias?: string;
  exists: boolean;
  warning?: string;
}

export interface TestContent {
  name: string;
  content: string;
  mtime: string;
}

export interface DeviceOption {
  name: string;
  label: string;
  platform: 'android' | 'ios';
  running: boolean;
}

export interface ConnectionState {
  connected: boolean;
  platform: 'android' | 'ios' | null;
  deviceName: string | null;
  deviceId: string | null;
  osVersion?: string;
  resolution?: string;
  deviceInfo?: {
    device_width: number;
    device_height: number;
    scaled_width: number;
    scaled_height: number;
    scale: number;
  };
}

export interface LogEvent {
  ts: string;
  kind: LogKind;
  text: string;
  eventType?: ExecutionEventType;
  actionType?: ExecutionActionType;
  runId?: string;
  stepId?: string;
  instructionIndex?: number;
  payload?: Record<string, unknown>;
}

export interface ExecutionStartResult {
  runId: string;
}

export interface DesignStartResult {
  sessionId: string;
}

export interface ExecutionRespondResult {
  accepted: true;
}

export interface DesignInputResult {
  accepted: true;
}

export interface DesignReviseResult {
  script: string;
}

export interface DesignSaveResult {
  createdName: string;
  path: string;
  folderId: string;
}

export interface DesignStateResult {
  phase: 'idle' | 'awaiting_initial_input' | 'exploring' | 'script_generated' | 'saving' | 'error';
  hasScript: boolean;
  script?: string;
}

export interface SaveResult {
  mtime: string;
}

export interface CreateResult {
  createdName: string;
  path: string;
}

export interface RenameResult {
  renamedName: string;
  path: string;
}

export interface ApplyRevisionResult {
  revisedContent: string;
}

export interface DesktopApi {
  workspace: {
    getCurrent: () => Promise<WorkspaceInfo>;
  };
  projects: {
    list: () => Promise<ProjectFolder[]>;
    add: () => Promise<ProjectFolder | null>;
    setAlias: (payload: { folderId: string; alias: string }) => Promise<ProjectFolder>;
    open: (payload: { folderId: string }) => Promise<void>;
    remove: (payload: { folderId: string }) => Promise<void>;
  };
  tests: {
    list: (payload: { folderId: string }) => Promise<ProjectTestFile[]>;
    create: (payload: { folderId: string; requestedName: string }) => Promise<CreateResult>;
    rename: (payload: { folderId: string; fromName: string; requestedName: string }) => Promise<RenameResult>;
    applyRevision: (payload: { content: string; revisionPrompt: string }) => Promise<ApplyRevisionResult>;
    read: (payload: { folderId: string; name: string }) => Promise<TestContent>;
    save: (payload: { folderId: string; name: string; content: string }) => Promise<SaveResult>;
    delete: (payload: { folderId: string; name: string }) => Promise<void>;
  };
  devices: {
    refresh: (payload: { platform: 'android' | 'ios' }) => Promise<DeviceOption[]>;
    connect: (payload: { platform: 'android' | 'ios'; deviceName: string }) => Promise<ConnectionState>;
    getState: () => Promise<ConnectionState>;
  };
  execution: {
    start: (payload: { testPath: string; testName: string }) => Promise<ExecutionStartResult>;
    stop: (payload: { runId: string }) => Promise<{ stopped: true }>;
    respond: (payload: { runId: string; input: string }) => Promise<ExecutionRespondResult>;
  };
  design: {
    start: () => Promise<DesignStartResult>;
    input: (payload: { sessionId: string; input: string }) => Promise<DesignInputResult>;
    revise: (payload: { sessionId: string; revisionPrompt: string }) => Promise<DesignReviseResult>;
    save: (payload: { sessionId: string; folderId: string; requestedName: string }) => Promise<DesignSaveResult>;
    stop: (payload: { sessionId: string }) => Promise<{ stopped: true }>;
    getState: (payload: { sessionId: string }) => Promise<DesignStateResult>;
  };
  settings: {
    get: () => Promise<Record<string, unknown>>;
    set: (next: Record<string, unknown>) => Promise<void>;
  };
  events: {
    onExecutionLog: (handler: (event: LogEvent) => void) => () => void;
    onDeviceLog: (handler: (event: LogEvent) => void) => () => void;
    onDesignLog: (handler: (event: LogEvent) => void) => () => void;
  };
}

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}
