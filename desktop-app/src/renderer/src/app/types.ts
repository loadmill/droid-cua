import type { ConnectionState, DeviceOption, LogEvent, ProjectFolder, ProjectTestFile, WorkspaceInfo } from '../../../preload/types';

export type Section = 'new-test' | 'devices' | 'settings';

export type Pane = 'design-disabled' | 'editor' | 'execution' | 'devices' | 'settings';

export interface TestRef {
  folderId: string;
  testName: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  ref: TestRef;
}

export interface AppState {
  workspace: WorkspaceInfo | null;
  projectFolders: ProjectFolder[];
  testsByFolder: Record<string, ProjectTestFile[]>;
  selectedTestRef: TestRef | null;
  testContent: string;
  draft: string;
  section: Section;
  showCreateDialog: boolean;
  createTargetFolderId: string | null;
  requestedName: string;
  createError: string | null;
  showRenameDialog: boolean;
  renameValue: string;
  renameError: string | null;
  renameTargetRef: TestRef | null;
  contextMenu: ContextMenuState | null;
  executionLogsByTest: Record<string, LogEvent[]>;
  deviceLogs: LogEvent[];
  connection: ConnectionState;
  platform: 'android' | 'ios';
  deviceOptions: DeviceOption[];
  selectedDeviceName: string;
  activeRunId: string | null;
  pendingExecutionInputRequest: { options: string[] } | null;
  runningTestRef: TestRef | null;
  isStopping: boolean;
  isExecutionView: boolean;
  isBusy: boolean;
  showCommandMenu: boolean;
  composerInput: string;
  isApplyingRevision: boolean;
}
