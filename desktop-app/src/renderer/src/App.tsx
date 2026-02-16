import { AppShell } from './components/layout/AppShell';
import { MainHeader } from './components/layout/MainHeader';
import { Sidebar } from './components/sidebar/Sidebar';
import { DevicesPane } from './components/panes/DevicesPane';
import { DesignDisabledPane } from './components/panes/DesignDisabledPane';
import { EditorPane } from './components/panes/EditorPane';
import { ExecutionPane } from './components/panes/ExecutionPane';
import { SettingsPane } from './components/panes/SettingsPane';
import { CommandMenuDialog } from './components/dialogs/CommandMenuDialog';
import { CreateTestDialog } from './components/dialogs/CreateTestDialog';
import { RenameTestDialog } from './components/dialogs/RenameTestDialog';
import { TestContextMenu } from './components/dialogs/TestContextMenu';
import { useAppController } from './app/useAppController';

export function App() {
  const { state, derived, actions } = useAppController();

  return (
    <>
      <AppShell
        sidebar={
          <Sidebar
            section={state.section}
            connection={state.connection}
            folders={state.projectFolders}
            testsByFolder={state.testsByFolder}
            selectedTestRef={state.selectedTestRef}
            activeRunId={state.activeRunId}
            runningTestRef={state.runningTestRef}
            onSectionChange={actions.setSection}
            onAddFolder={() => void actions.handleAddProjectFolder()}
            onOpenCreateDialog={(folderId) => {
              actions.setCreateTargetFolderId(folderId);
              actions.setShowCreateDialog(true);
            }}
            onRenameFolder={async (folderId, name) => {
              await actions.handleRenameProjectFolder(folderId, name);
            }}
            onOpenFolder={async (folderId) => {
              await actions.handleOpenProjectFolder(folderId);
            }}
            onRemoveFolder={async (folderId) => {
              await actions.handleRemoveProjectFolder(folderId);
            }}
            onSelectTest={(ref, isRunning) => {
              actions.setSection('new-test');
              actions.setExecutionView(isRunning);
              actions.setSelectedTestRef(ref);
            }}
            onRightClickTest={(event, ref) => {
              actions.setContextMenu({ x: event.clientX, y: event.clientY, ref });
            }}
          />
        }
        header={
          <MainHeader
            pane={derived.pane}
            workspace={state.workspace}
            selectedTest={derived.selectedTest}
            connection={state.connection}
            activeRunId={state.activeRunId}
            isStopping={state.isStopping}
            onStop={() => void actions.handleStop()}
            onOpenCommandMenu={() => actions.setShowCommandMenu(true)}
          />
        }
      >
        {derived.pane === 'devices' ? (
          <DevicesPane
            platform={state.platform}
            selectedDeviceName={state.selectedDeviceName}
            deviceOptions={state.deviceOptions}
            deviceLogs={state.deviceLogs}
            isBusy={state.isBusy}
            onSetPlatform={actions.setPlatform}
            onSetSelectedDeviceName={actions.setSelectedDeviceName}
            onRefreshDevices={actions.handleRefreshDevices}
            onConnect={actions.handleConnect}
            onClearLogs={() => actions.setDeviceLogs([])}
          />
        ) : null}

        {derived.pane === 'design-disabled' ? <DesignDisabledPane /> : null}

        {derived.pane === 'editor' ? (
          <EditorPane
            selectedTest={derived.selectedTest}
            draft={state.draft}
            isDirty={derived.isDirty}
            composerInput={state.composerInput}
            isApplyingRevision={state.isApplyingRevision}
            canApplyRevision={derived.canApplyRevision}
            onDraftChange={actions.setDraft}
            onSave={actions.handleSave}
            onDelete={actions.handleDelete}
            onRun={actions.handleRun}
            onComposerInputChange={actions.setComposerInput}
            onApplyRevision={actions.handleApplyRevision}
          />
        ) : null}

        {derived.pane === 'execution' ? (
          <ExecutionPane executionLogs={derived.executionLogs} isRunning={derived.isRunning} isStopping={state.isStopping} onStop={actions.handleStop} />
        ) : null}

        {derived.pane === 'settings' ? <SettingsPane workspacePath={state.workspace?.rootPath} /> : null}
      </AppShell>

      <CreateTestDialog
        open={state.showCreateDialog}
        targetFolderName={state.projectFolders.find((folder) => folder.id === state.createTargetFolderId)?.name ?? null}
        requestedName={state.requestedName}
        createError={state.createError}
        onOpenChange={(open) => {
          actions.setShowCreateDialog(open);
          if (!open) {
            actions.setCreateTargetFolderId(null);
          }
        }}
        onRequestedNameChange={actions.setRequestedName}
        onCreate={actions.handleCreateTest}
      />

      <CommandMenuDialog
        open={state.showCommandMenu}
        onOpenChange={actions.setShowCommandMenu}
        onOpenDevices={() => {
          actions.setSection('devices');
          actions.setShowCommandMenu(false);
        }}
        onOpenProjects={() => {
          actions.setSection('new-test');
          actions.setExecutionView(false);
          actions.setShowCommandMenu(false);
        }}
        onOpenSettings={() => {
          actions.setSection('settings');
          actions.setShowCommandMenu(false);
        }}
        onRefreshTests={async () => {
          await actions.refreshTests();
          actions.setShowCommandMenu(false);
        }}
        onRefreshDevices={async () => {
          await actions.handleRefreshDevices();
          actions.setShowCommandMenu(false);
        }}
      />

      <RenameTestDialog
        open={state.showRenameDialog}
        renameValue={state.renameValue}
        renameError={state.renameError}
        onOpenChange={actions.setShowRenameDialog}
        onRenameValueChange={actions.setRenameValue}
        onRename={actions.handleRenameTest}
      />

      <TestContextMenu
        menu={state.contextMenu}
        onClose={() => actions.setContextMenu(null)}
        onRename={(ref) => {
          actions.setRenameTargetRef(ref);
          actions.setRenameValue(ref.testName.replace(/\.dcua$/i, ''));
          actions.setRenameError(null);
          actions.setShowRenameDialog(true);
          actions.setContextMenu(null);
        }}
        onDelete={(ref) => {
          actions.setContextMenu(null);
          void actions.handleDeleteByRef(ref);
        }}
      />
    </>
  );
}
