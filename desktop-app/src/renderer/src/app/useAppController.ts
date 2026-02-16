import { useEffect, useMemo, useState } from 'react';
import type { ConnectionState } from '../../../preload/types';
import type { AppState, Pane, Section, TestRef } from './types';

const defaultConnection: ConnectionState = {
  connected: false,
  platform: null,
  deviceName: null,
  deviceId: null
};

function testRefKey(ref: TestRef): string {
  return `${ref.folderId}::${ref.testName.toLowerCase()}`;
}

function sameTestRef(a: TestRef | null, b: TestRef | null): boolean {
  if (!a || !b) return false;
  return a.folderId === b.folderId && a.testName.toLowerCase() === b.testName.toLowerCase();
}

export function useAppController() {
  const [workspace, setWorkspace] = useState<AppState['workspace']>(null);
  const [projectFolders, setProjectFolders] = useState<AppState['projectFolders']>([]);
  const [testsByFolder, setTestsByFolder] = useState<AppState['testsByFolder']>({});
  const [selectedTestRef, setSelectedTestRef] = useState<AppState['selectedTestRef']>(null);
  const [testContent, setTestContent] = useState('');
  const [draft, setDraft] = useState('');
  const [section, setSection] = useState<Section>('new-test');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createTargetFolderId, setCreateTargetFolderId] = useState<string | null>(null);
  const [requestedName, setRequestedName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameTargetRef, setRenameTargetRef] = useState<TestRef | null>(null);
  const [contextMenu, setContextMenu] = useState<AppState['contextMenu']>(null);
  const [executionLogsByTest, setExecutionLogsByTest] = useState<AppState['executionLogsByTest']>({});
  const [deviceLogs, setDeviceLogs] = useState<AppState['deviceLogs']>([]);
  const [connection, setConnection] = useState<ConnectionState>(defaultConnection);
  const [platform, setPlatform] = useState<'android' | 'ios'>('ios');
  const [deviceOptions, setDeviceOptions] = useState<AppState['deviceOptions']>([]);
  const [selectedDeviceName, setSelectedDeviceName] = useState('');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runningTestRef, setRunningTestRef] = useState<TestRef | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [isExecutionView, setExecutionView] = useState(false);
  const [isBusy, setBusy] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [composerInput, setComposerInput] = useState('');
  const [isApplyingRevision, setApplyingRevision] = useState(false);

  const pane: Pane = useMemo(() => {
    if (section === 'devices') return 'devices';
    if (section === 'settings') return 'settings';
    if (isExecutionView) return 'execution';
    if (selectedTestRef) return 'editor';
    return 'design-disabled';
  }, [isExecutionView, section, selectedTestRef]);

  const selectedTest = useMemo(() => {
    if (!selectedTestRef) return undefined;
    const folderTests = testsByFolder[selectedTestRef.folderId] ?? [];
    return folderTests.find(
      (test) =>
        test.filename.toLowerCase() === selectedTestRef.testName.toLowerCase() ||
        `${test.name}.dcua`.toLowerCase() === selectedTestRef.testName.toLowerCase()
    );
  }, [selectedTestRef, testsByFolder]);

  const executionLogRef = runningTestRef ?? selectedTestRef;
  const executionLogs = useMemo(() => {
    if (!executionLogRef) return [];
    return executionLogsByTest[testRefKey(executionLogRef)] ?? [];
  }, [executionLogRef, executionLogsByTest]);

  const isDirty = draft !== testContent;
  const isRunning = Boolean(activeRunId);
  const canApplyRevision = pane === 'editor' && Boolean(selectedTestRef) && Boolean(composerInput.trim()) && !isApplyingRevision;

  useEffect(() => {
    const unsubs = [
      window.desktopApi.events.onExecutionLog((entry) => {
        setExecutionLogsByTest((prev) => {
          if (!runningTestRef) return prev;
          const key = testRefKey(runningTestRef);
          return {
            ...prev,
            [key]: [...(prev[key] ?? []), entry]
          };
        });

        if (entry.text.startsWith('Execution finished:')) {
          setActiveRunId(null);
          setRunningTestRef(null);
          setIsStopping(false);
        }
      }),
      window.desktopApi.events.onDeviceLog((entry) => {
        setDeviceLogs((prev) => [...prev, entry]);
      })
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [runningTestRef]);

  async function refreshProjectsAndTests(selectRef?: TestRef | null): Promise<void> {
    const folders = await window.desktopApi.projects.list();
    const listedByFolder = await Promise.all(
      folders.map(async (folder) => ({
        folderId: folder.id,
        tests: folder.exists ? await window.desktopApi.tests.list({ folderId: folder.id }) : []
      }))
    );

    setProjectFolders(folders);
    setTestsByFolder(Object.fromEntries(listedByFolder.map((entry) => [entry.folderId, entry.tests])));

    if (!selectRef) return;
    setSelectedTestRef(selectRef);
    setSection('new-test');
  }

  useEffect(() => {
    void (async () => {
      const [workspaceInfo, conn] = await Promise.all([window.desktopApi.workspace.getCurrent(), window.desktopApi.devices.getState()]);
      setWorkspace(workspaceInfo);
      setConnection(conn);
      if (conn.platform) {
        setPlatform(conn.platform);
      }
      await refreshProjectsAndTests();
    })();
  }, []);

  useEffect(() => {
    if (!selectedTestRef) {
      setTestContent('');
      setDraft('');
      return;
    }

    void (async () => {
      const file = await window.desktopApi.tests.read({ folderId: selectedTestRef.folderId, name: selectedTestRef.testName });
      setTestContent(file.content);
      setDraft(file.content);
    })();
  }, [selectedTestRef]);

  useEffect(() => {
    if (section !== 'devices') return;
    void handleRefreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, platform]);

  async function refreshTests(selectRef?: TestRef): Promise<void> {
    await refreshProjectsAndTests(selectRef ?? null);
  }

  async function handleAddProjectFolder(): Promise<void> {
    await window.desktopApi.projects.add();
    await refreshProjectsAndTests();
  }

  async function handleRenameProjectFolder(folderId: string, name: string): Promise<void> {
    await window.desktopApi.projects.setAlias({ folderId, alias: name });
    await refreshProjectsAndTests();
  }

  async function handleRemoveProjectFolder(folderId: string): Promise<void> {
    if (selectedTestRef?.folderId === folderId) {
      setSelectedTestRef(null);
      setExecutionView(false);
      setTestContent('');
      setDraft('');
    }

    if (runningTestRef?.folderId === folderId) {
      setRunningTestRef(null);
      setActiveRunId(null);
      setIsStopping(false);
    }

    await window.desktopApi.projects.remove({ folderId });
    await refreshProjectsAndTests();
  }

  async function handleOpenProjectFolder(folderId: string): Promise<void> {
    await window.desktopApi.projects.open({ folderId });
  }

  async function handleCreateTest(): Promise<void> {
    if (!createTargetFolderId) {
      setCreateError('Select a project folder first.');
      return;
    }

    setCreateError(null);
    try {
      const created = await window.desktopApi.tests.create({
        folderId: createTargetFolderId,
        requestedName
      });
      const createdRef = { folderId: createTargetFolderId, testName: created.createdName };
      await refreshProjectsAndTests(createdRef);
      setExecutionView(false);
      setShowCreateDialog(false);
      setCreateTargetFolderId(null);
      setRequestedName('');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create file.');
    }
  }

  async function handleSave(): Promise<void> {
    if (!selectedTestRef) return;
    await window.desktopApi.tests.save({ folderId: selectedTestRef.folderId, name: selectedTestRef.testName, content: draft });
    setTestContent(draft);
    await refreshProjectsAndTests(selectedTestRef);
  }

  async function handleDelete(): Promise<void> {
    if (!selectedTestRef) return;
    await window.desktopApi.tests.delete({ folderId: selectedTestRef.folderId, name: selectedTestRef.testName });
    setExecutionView(false);
    setSelectedTestRef(null);
    setTestContent('');
    setDraft('');
    await refreshProjectsAndTests();
  }

  async function handleDeleteByRef(ref: TestRef): Promise<void> {
    await window.desktopApi.tests.delete({ folderId: ref.folderId, name: ref.testName });
    if (sameTestRef(selectedTestRef, ref)) {
      setExecutionView(false);
      setSelectedTestRef(null);
      setTestContent('');
      setDraft('');
    }
    await refreshProjectsAndTests();
  }

  async function handleRenameTest(): Promise<void> {
    if (!renameTargetRef) return;
    setRenameError(null);

    try {
      const { renamedName } = await window.desktopApi.tests.rename({
        folderId: renameTargetRef.folderId,
        fromName: renameTargetRef.testName,
        requestedName: renameValue
      });
      const renamedRef = {
        folderId: renameTargetRef.folderId,
        testName: renamedName
      };
      await refreshProjectsAndTests(renamedRef);
      setShowRenameDialog(false);
      setRenameTargetRef(null);
      setRenameValue('');
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : 'Failed to rename test.');
    }
  }

  async function handleRefreshDevices(): Promise<void> {
    setBusy(true);
    try {
      const refreshed = await window.desktopApi.devices.refresh({ platform });
      setDeviceOptions(refreshed);
      if (refreshed.length > 0 && !selectedDeviceName) {
        setSelectedDeviceName(refreshed[0].name);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to refresh devices.';
      setDeviceLogs((prev) => [...prev, { ts: new Date().toISOString(), kind: 'error', text }]);
    } finally {
      setBusy(false);
    }
  }

  async function handleConnect(): Promise<void> {
    if (!selectedDeviceName) return;
    setBusy(true);
    try {
      const connected = await window.desktopApi.devices.connect({
        platform,
        deviceName: selectedDeviceName
      });
      setConnection(connected);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to connect.';
      setDeviceLogs((prev) => [...prev, { ts: new Date().toISOString(), kind: 'error', text }]);
    } finally {
      setBusy(false);
    }
  }

  async function handleRun(): Promise<void> {
    if (!selectedTestRef || !selectedTest) return;
    try {
      const runRef = { ...selectedTestRef };
      const runKey = testRefKey(runRef);
      setExecutionLogsByTest((prev) => ({ ...prev, [runKey]: [] }));
      setExecutionView(true);
      setRunningTestRef(runRef);
      setIsStopping(false);
      const { runId } = await window.desktopApi.execution.start({
        testPath: selectedTest.path,
        testName: selectedTest.filename
      });
      setActiveRunId(runId);
    } catch (error) {
      setExecutionView(false);
      setRunningTestRef(null);
      const text = error instanceof Error ? error.message : 'Failed to start execution.';
      if (selectedTestRef) {
        const key = testRefKey(selectedTestRef);
        setExecutionLogsByTest((prev) => ({
          ...prev,
          [key]: [...(prev[key] ?? []), { ts: new Date().toISOString(), kind: 'error', text }]
        }));
      }
    }
  }

  async function handleStop(): Promise<void> {
    if (!activeRunId || isStopping) return;
    setIsStopping(true);

    if (runningTestRef) {
      const key = testRefKey(runningTestRef);
      setExecutionLogsByTest((prev) => ({
        ...prev,
        [key]: [
          ...(prev[key] ?? []),
          {
            ts: new Date().toISOString(),
            kind: 'info',
            text: 'Stopping test execution — previously submitted actions may still occur.'
          }
        ]
      }));
    }

    try {
      await window.desktopApi.execution.stop({ runId: activeRunId });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to stop execution.';
      if (runningTestRef) {
        const key = testRefKey(runningTestRef);
        setExecutionLogsByTest((prev) => ({
          ...prev,
          [key]: [...(prev[key] ?? []), { ts: new Date().toISOString(), kind: 'error', text }]
        }));
      }
      setIsStopping(false);
    }
  }

  async function handleApplyRevision(): Promise<void> {
    if (!selectedTestRef || !composerInput.trim() || isApplyingRevision) return;
    setApplyingRevision(true);
    try {
      const { revisedContent } = await window.desktopApi.tests.applyRevision({
        content: draft,
        revisionPrompt: composerInput
      });
      setDraft(revisedContent);
      setComposerInput('');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to apply revision.';
      if (selectedTestRef) {
        const key = testRefKey(selectedTestRef);
        setExecutionLogsByTest((prev) => ({
          ...prev,
          [key]: [...(prev[key] ?? []), { ts: new Date().toISOString(), kind: 'error', text }]
        }));
      }
    } finally {
      setApplyingRevision(false);
    }
  }

  const state: AppState = {
    workspace,
    projectFolders,
    testsByFolder,
    selectedTestRef,
    testContent,
    draft,
    section,
    showCreateDialog,
    createTargetFolderId,
    requestedName,
    createError,
    showRenameDialog,
    renameValue,
    renameError,
    renameTargetRef,
    contextMenu,
    executionLogsByTest,
    deviceLogs,
    connection,
    platform,
    deviceOptions,
    selectedDeviceName,
    activeRunId,
    runningTestRef,
    isStopping,
    isExecutionView,
    isBusy,
    showCommandMenu,
    composerInput,
    isApplyingRevision
  };

  const derived = {
    pane,
    isDirty,
    selectedTest,
    isRunning,
    canApplyRevision,
    executionLogs
  };

  const actions = {
    refreshTests,
    handleAddProjectFolder,
    handleRenameProjectFolder,
    handleRemoveProjectFolder,
    handleOpenProjectFolder,
    handleCreateTest,
    handleSave,
    handleDelete,
    handleDeleteByRef,
    handleRenameTest,
    handleRefreshDevices,
    handleConnect,
    handleRun,
    handleStop,
    handleApplyRevision,
    setWorkspace,
    setProjectFolders,
    setTestsByFolder,
    setSelectedTestRef,
    setTestContent,
    setDraft,
    setSection,
    setShowCreateDialog,
    setCreateTargetFolderId,
    setRequestedName,
    setCreateError,
    setShowRenameDialog,
    setRenameValue,
    setRenameError,
    setRenameTargetRef,
    setContextMenu,
    setExecutionLogsByTest,
    setDeviceLogs,
    setConnection,
    setPlatform,
    setDeviceOptions,
    setSelectedDeviceName,
    setActiveRunId,
    setRunningTestRef,
    setIsStopping,
    setExecutionView,
    setBusy,
    setShowCommandMenu,
    setComposerInput,
    setApplyingRevision
  };

  return { state, derived, actions };
}

export type AppController = ReturnType<typeof useAppController>;
