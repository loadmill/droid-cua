import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import dotenv from 'dotenv';
import type { LogEvent } from '../preload/types';
import { connectDevice, getConnectionState, refreshDevices } from './services/device-service';
import { respondExecution, startExecution, stopExecution } from './services/execution-service';
import { getDesignState, hasActiveDesignSession, reviseGeneratedScript, saveGeneratedScript, startDesign, stopDesign, submitDesignInput } from './services/design-service';
import { addProjectFolder, getProjectFolderById, listProjectFolders, removeProjectFolder, setProjectFolderAlias } from './services/project-folders-service';
import { getSettings, setSettings } from './services/settings-service';
import { applyRevisionToContent, createTest, deleteTest, listTests, readTest, renameTest, saveTest } from './services/test-service';
import { getWorkspaceInfo } from './services/workspace';

let mainWindow: BrowserWindow | null = null;
const execFileAsync = promisify(execFile);

function sendEvent(channel: 'events:executionLog' | 'events:deviceLog' | 'events:designLog', event: LogEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(channel, event);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: '#f1f4fb',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the system default browser instead of new Electron windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function setupHandlers(): void {
  ipcMain.handle('workspace:getCurrent', async () => getWorkspaceInfo());

  ipcMain.handle('projects:list', async () => listProjectFolders());
  ipcMain.handle('projects:add', async () => {
    const response = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Add project folder'
    });

    if (response.canceled || response.filePaths.length === 0) {
      return null;
    }

    return await addProjectFolder(response.filePaths[0]);
  });
  ipcMain.handle('projects:remove', async (_event, payload: { folderId: string }) => removeProjectFolder(payload.folderId));
  ipcMain.handle('projects:setAlias', async (_event, payload: { folderId: string; alias: string }) => setProjectFolderAlias(payload.folderId, payload.alias));
  ipcMain.handle('projects:open', async (_event, payload: { folderId: string }) => {
    const folder = await getProjectFolderById(payload.folderId);
    if (!folder) {
      throw new Error('Project folder not found.');
    }

    if (!folder.exists) {
      throw new Error('Project folder is unavailable.');
    }

    if (process.platform === 'darwin') {
      await execFileAsync('open', [folder.path]);
      return;
    }

    const openError = await shell.openPath(folder.path);
    if (openError) {
      throw new Error(openError);
    }
  });

  ipcMain.handle('tests:list', async (_event, payload: { folderId: string }) => {
    const folder = await getProjectFolderById(payload.folderId);
    if (!folder) {
      throw new Error('Project folder not found.');
    }
    return await listTests(folder.id, folder.path);
  });
  ipcMain.handle('tests:create', async (_event, payload: { folderId: string; requestedName: string }) => {
    const folder = await getProjectFolderById(payload.folderId);
    if (!folder) {
      throw new Error('Project folder not found.');
    }
    if (!folder.exists) {
      throw new Error('Project folder is unavailable.');
    }
    return await createTest(folder.path, payload.requestedName);
  });
  ipcMain.handle('tests:rename', async (_event, payload: { folderId: string; fromName: string; requestedName: string }) => {
    const folder = await getProjectFolderById(payload.folderId);
    if (!folder) {
      throw new Error('Project folder not found.');
    }
    return await renameTest(folder.path, payload.fromName, payload.requestedName);
  });
  ipcMain.handle('tests:applyRevision', async (_event, payload: { content: string; revisionPrompt: string }) => ({
    revisedContent: await applyRevisionToContent(payload.content, payload.revisionPrompt)
  }));
  ipcMain.handle('tests:read', async (_event, payload: { folderId: string; name: string }) => {
    const folder = await getProjectFolderById(payload.folderId);
    if (!folder) {
      throw new Error('Project folder not found.');
    }
    return await readTest(folder.path, payload.name);
  });
  ipcMain.handle('tests:save', async (_event, payload: { folderId: string; name: string; content: string }) => {
    const folder = await getProjectFolderById(payload.folderId);
    if (!folder) {
      throw new Error('Project folder not found.');
    }
    return await saveTest(folder.path, payload.name, payload.content);
  });
  ipcMain.handle('tests:delete', async (_event, payload: { folderId: string; name: string }) => {
    const folder = await getProjectFolderById(payload.folderId);
    if (!folder) {
      throw new Error('Project folder not found.');
    }
    return await deleteTest(folder.path, payload.name);
  });

  ipcMain.handle('devices:refresh', async (_event, payload: { platform: 'android' | 'ios' }) =>
    refreshDevices(payload.platform, (entry) => sendEvent('events:deviceLog', entry))
  );
  ipcMain.handle('devices:connect', async (_event, payload: { platform: 'android' | 'ios'; deviceName: string }) =>
    connectDevice(payload, (entry) => sendEvent('events:deviceLog', entry))
  );
  ipcMain.handle('devices:getState', async () => getConnectionState());

  ipcMain.handle('execution:start', async (_event, payload: { testPath: string; testName: string }) => {
    if (hasActiveDesignSession()) {
      throw new Error('Cannot start test execution while design mode is active.');
    }
    return startExecution(payload.testPath, payload.testName, (entry) => sendEvent('events:executionLog', entry));
  });
  ipcMain.handle('execution:stop', async (_event, payload: { runId: string }) => stopExecution(payload.runId));
  ipcMain.handle('execution:respond', async (_event, payload: { runId: string; input: string }) => respondExecution(payload.runId, payload.input));

  ipcMain.handle('design:start', async () => startDesign((entry) => sendEvent('events:designLog', entry)));
  ipcMain.handle('design:input', async (_event, payload: { sessionId: string; input: string }) => submitDesignInput(payload.sessionId, payload.input));
  ipcMain.handle('design:revise', async (_event, payload: { sessionId: string; revisionPrompt: string }) =>
    reviseGeneratedScript(payload.sessionId, payload.revisionPrompt)
  );
  ipcMain.handle('design:save', async (_event, payload: { sessionId: string; folderId: string; requestedName: string }) =>
    saveGeneratedScript(payload.sessionId, { folderId: payload.folderId, requestedName: payload.requestedName })
  );
  ipcMain.handle('design:stop', async (_event, payload: { sessionId: string }) => stopDesign(payload.sessionId));
  ipcMain.handle('design:getState', async (_event, payload: { sessionId: string }) => getDesignState(payload.sessionId));

  ipcMain.handle('settings:get', async () => getSettings());
  ipcMain.handle('settings:set', async (_event, next: Record<string, unknown>) => setSettings(next));
}

function loadEnv(): void {
  const workspace = getWorkspaceInfo();
  dotenv.config({ path: path.join(workspace.rootPath, '.env') });
}

app.whenReady().then(() => {
  loadEnv();
  setupHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
