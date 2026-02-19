import { useEffect, useMemo, useState } from 'react';
import type { ConnectionState, LogEvent } from '../../../preload/types';
import type { AppState, DesignPhase, Pane, PromptCustomizations, Section, TestRef } from './types';

const defaultConnection: ConnectionState = {
  connected: false,
  platform: null,
  deviceName: null,
  deviceId: null
};

const emptyPromptCustomizations: PromptCustomizations = {
  basePromptInstructions: '',
  designModeInstructions: '',
  executionModeInstructions: ''
};

function readPromptCustomizations(settings: Record<string, unknown>): PromptCustomizations {
  const raw =
    settings.promptCustomizations && typeof settings.promptCustomizations === 'object'
      ? (settings.promptCustomizations as Record<string, unknown>)
      : {};

  return {
    basePromptInstructions: typeof raw.basePromptInstructions === 'string' ? raw.basePromptInstructions : '',
    designModeInstructions: typeof raw.designModeInstructions === 'string' ? raw.designModeInstructions : '',
    executionModeInstructions: typeof raw.executionModeInstructions === 'string' ? raw.executionModeInstructions : ''
  };
}

function testRefKey(ref: TestRef): string {
  return `${ref.folderId}::${ref.testName.toLowerCase()}`;
}

function sameTestRef(a: TestRef | null, b: TestRef | null): boolean {
  if (!a || !b) return false;
  return a.folderId === b.folderId && a.testName.toLowerCase() === b.testName.toLowerCase();
}

function readDesignPhase(entry: LogEvent): DesignPhase | null {
  const phase = entry.payload?.phase;
  if (
    phase === 'idle' ||
    phase === 'awaiting_initial_input' ||
    phase === 'exploring' ||
    phase === 'script_generated' ||
    phase === 'saving' ||
    phase === 'error'
  ) {
    return phase;
  }
  return null;
}

function readScriptPayload(entry: LogEvent): string | null {
  const script = entry.payload?.script;
  return typeof script === 'string' ? script : null;
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
  const [pendingExecutionInputRequest, setPendingExecutionInputRequest] = useState<AppState['pendingExecutionInputRequest']>(null);
  const [runningTestRef, setRunningTestRef] = useState<TestRef | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [isExecutionView, setExecutionView] = useState(false);
  const [isBusy, setBusy] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [composerInput, setComposerInput] = useState('');
  const [isApplyingRevision, setApplyingRevision] = useState(false);

  const [designSessionId, setDesignSessionId] = useState<string | null>(null);
  const [designLogs, setDesignLogs] = useState<LogEvent[]>([]);
  const [isDesignRunning, setIsDesignRunning] = useState(false);
  const [designPhase, setDesignPhase] = useState<DesignPhase>('idle');
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [designInput, setDesignInput] = useState('');
  const [pendingRevisionPrompt, setPendingRevisionPrompt] = useState('');
  const [showDesignSaveDialog, setShowDesignSaveDialog] = useState(false);
  const [designSaveTargetFolderId, setDesignSaveTargetFolderId] = useState<string | null>(null);
  const [designRequestedName, setDesignRequestedName] = useState('');
  const [designError, setDesignError] = useState<string | null>(null);
  const [promptCustomizations, setPromptCustomizations] = useState<PromptCustomizations>(emptyPromptCustomizations);
  const [promptCustomizationsError, setPromptCustomizationsError] = useState<string | null>(null);
  const [promptCustomizationsHydrated, setPromptCustomizationsHydrated] = useState(false);

  const pane: Pane = useMemo(() => {
    if (section === 'devices') return 'devices';
    if (section === 'settings') return 'settings';
    if (isExecutionView) return 'execution';
    if (selectedTestRef) return 'editor';
    return 'design';
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
          setPendingExecutionInputRequest(null);
          setRunningTestRef(null);
          setIsStopping(false);
        }
        if (entry.eventType === 'input_request') {
          const options =
            Array.isArray(entry.payload?.options) && entry.payload.options.every((x) => typeof x === 'string')
              ? (entry.payload.options as string[])
              : ['retry', 'skip', 'stop'];
          setPendingExecutionInputRequest({ options });
        }
      }),
      window.desktopApi.events.onDeviceLog((entry) => {
        setDeviceLogs((prev) => [...prev, entry]);
      }),
      window.desktopApi.events.onDesignLog((entry) => {
        setDesignLogs((prev) => [...prev, entry]);

        const phase = readDesignPhase(entry);
        if (phase) {
          setDesignPhase(phase);
        }

        if (entry.eventType === 'design_started') {
          setDesignError(null);
          setGeneratedScript(null);
          setShowDesignSaveDialog(false);
          setPendingRevisionPrompt('');
        }

        if (entry.eventType === 'design_generated_script') {
          const script = readScriptPayload(entry);
          if (script) {
            setGeneratedScript(script);
            setDesignPhase('script_generated');
            setIsDesignRunning(false);
          }
        }

        if (entry.eventType === 'design_error') {
          setDesignError(entry.text || 'Design mode failed.');
          setDesignPhase('error');
          setIsDesignRunning(false);
        }

        if (entry.eventType === 'design_saved' || entry.eventType === 'design_finished') {
          setIsDesignRunning(false);
        }
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
      const [workspaceInfo, conn, settings] = await Promise.all([
        window.desktopApi.workspace.getCurrent(),
        window.desktopApi.devices.getState(),
        window.desktopApi.settings.get()
      ]);
      setWorkspace(workspaceInfo);
      setConnection(conn);
      setPromptCustomizations(readPromptCustomizations(settings));
      setPromptCustomizationsHydrated(true);
      if (conn.platform) {
        setPlatform(conn.platform);
      }
      await refreshProjectsAndTests();
    })();
  }, []);

  useEffect(() => {
    if (!promptCustomizationsHydrated) return;

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          setPromptCustomizationsError(null);
          const current = await window.desktopApi.settings.get();
          await window.desktopApi.settings.set({
            ...current,
            promptCustomizations
          });
        } catch (error) {
          setPromptCustomizationsError(error instanceof Error ? error.message : 'Failed to save prompt settings.');
        }
      })();
    }, 450);

    return () => clearTimeout(timeout);
  }, [promptCustomizations, promptCustomizationsHydrated]);

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
    if (designSessionId) {
      setDesignError('Cannot run a test while design mode is active. Exit design mode first.');
      return;
    }
    try {
      const runRef = { ...selectedTestRef };
      const runKey = testRefKey(runRef);
      setExecutionLogsByTest((prev) => ({ ...prev, [runKey]: [] }));
      setExecutionView(true);
      setRunningTestRef(runRef);
      setPendingExecutionInputRequest(null);
      setIsStopping(false);
      const { runId } = await window.desktopApi.execution.start({
        testPath: selectedTest.path,
        testName: selectedTest.filename
      });
      setActiveRunId(runId);
    } catch (error) {
      setExecutionView(false);
      setPendingExecutionInputRequest(null);
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

  async function handleExecutionResponse(input: string): Promise<void> {
    if (!activeRunId) return;
    await window.desktopApi.execution.respond({ runId: activeRunId, input });
    setPendingExecutionInputRequest(null);
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

  async function handleStartDesign(): Promise<string> {
    if (designSessionId) return designSessionId;
    setDesignError(null);
    setDesignLogs([]);
    setGeneratedScript(null);
    setPendingRevisionPrompt('');
    setShowDesignSaveDialog(false);

    const result = await window.desktopApi.design.start();
    setDesignSessionId(result.sessionId);
    setDesignPhase('awaiting_initial_input');
    setSection('new-test');
    setSelectedTestRef(null);
    setExecutionView(false);
    setIsDesignRunning(false);
    const firstExistingFolder = projectFolders.find((folder) => folder.exists);
    setDesignSaveTargetFolderId(firstExistingFolder?.id ?? null);
    return result.sessionId;
  }

  async function handleDesignInputSubmit(): Promise<void> {
    const input = designInput.trim();
    if (!input) return;

    try {
      let sessionId = designSessionId;
      if (!sessionId) {
        sessionId = await handleStartDesign();
      }

      await window.desktopApi.design.input({ sessionId, input });
      setDesignInput('');
      setDesignError(null);
      if (designPhase !== 'script_generated') {
        setDesignPhase('exploring');
        setIsDesignRunning(true);
      }
    } catch (error) {
      setDesignError(error instanceof Error ? error.message : 'Failed to submit design input.');
      setIsDesignRunning(false);
    }
  }

  async function handleDesignRevise(): Promise<void> {
    if (!designSessionId) return;
    const revisionPrompt = pendingRevisionPrompt.trim();
    if (!revisionPrompt) return;

    try {
      const { script } = await window.desktopApi.design.revise({ sessionId: designSessionId, revisionPrompt });
      setGeneratedScript(script);
      setPendingRevisionPrompt('');
      setDesignPhase('script_generated');
      setDesignError(null);
    } catch (error) {
      setDesignError(error instanceof Error ? error.message : 'Failed to revise script.');
    }
  }

  async function handleDesignSave(): Promise<void> {
    if (!designSessionId) return;
    if (!designSaveTargetFolderId) {
      setDesignError('Select a project folder before saving.');
      return;
    }

    try {
      setDesignPhase('saving');
      const saved = await window.desktopApi.design.save({
        sessionId: designSessionId,
        folderId: designSaveTargetFolderId,
        requestedName: designRequestedName
      });
      setShowDesignSaveDialog(false);
      setDesignSessionId(null);
      setIsDesignRunning(false);
      setDesignPhase('idle');
      setDesignInput('');
      setPendingRevisionPrompt('');
      setGeneratedScript(null);
      setDesignSaveTargetFolderId(null);
      setDesignRequestedName('');
      setDesignError(null);
      const createdRef = { folderId: saved.folderId, testName: saved.createdName };
      await refreshProjectsAndTests(createdRef);
      setExecutionView(false);
    } catch (error) {
      setDesignError(error instanceof Error ? error.message : 'Failed to save generated test.');
      setDesignPhase('script_generated');
    }
  }

  async function handleDesignStop(): Promise<void> {
    if (!designSessionId) return;
    try {
      await window.desktopApi.design.stop({ sessionId: designSessionId });
    } catch (error) {
      setDesignError(error instanceof Error ? error.message : 'Failed to stop design mode.');
    } finally {
      setDesignSessionId(null);
      setIsDesignRunning(false);
      setDesignPhase('idle');
      setDesignLogs([]);
      setDesignInput('');
      setPendingRevisionPrompt('');
      setGeneratedScript(null);
      setShowDesignSaveDialog(false);
      setDesignSaveTargetFolderId(null);
      setDesignRequestedName('');
      setDesignError(null);
    }
  }

  function handleDesignDiscard(): void {
    void handleDesignStop();
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
    pendingExecutionInputRequest,
    runningTestRef,
    isStopping,
    isExecutionView,
    isBusy,
    showCommandMenu,
    composerInput,
    isApplyingRevision,
    designSessionId,
    designLogs,
    isDesignRunning,
    designPhase,
    generatedScript,
    pendingRevisionPrompt,
    showDesignSaveDialog,
    designSaveTargetFolderId,
    designRequestedName,
    designError,
    promptCustomizations,
    promptCustomizationsError
  };

  const derived = {
    pane,
    isDirty,
    selectedTest,
    isRunning,
    canApplyRevision,
    executionLogs,
    designInput
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
    handleExecutionResponse,
    handleApplyRevision,
    handleStartDesign,
    handleDesignInputSubmit,
    handleDesignRevise,
    handleDesignSave,
    handleDesignStop,
    handleDesignDiscard,
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
    setApplyingRevision,
    setDesignInput,
    setPendingRevisionPrompt,
    setShowDesignSaveDialog,
    setDesignSaveTargetFolderId,
    setDesignRequestedName,
    setDesignError,
    setPromptCustomizations,
    setPromptCustomizationsError
  };

  return { state, derived, actions };
}

export type AppController = ReturnType<typeof useAppController>;
