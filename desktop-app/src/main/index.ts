import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import dotenv from 'dotenv';
import type { LogEvent } from '../preload/types';
import { connectDevice, getConnectionState, refreshDevices } from './services/device-service';
import { startExecution, stopExecution } from './services/execution-service';
import { addProjectFolder, getProjectFolderById, listProjectFolders, removeProjectFolder, renameProjectFolder } from './services/project-folders-service';
import { getSettings, setSettings } from './services/settings-service';
import { applyRevisionToContent, createTest, deleteTest, listTests, readTest, renameTest, saveTest } from './services/test-service';
import { getWorkspaceInfo } from './services/workspace';

let mainWindow: BrowserWindow | null = null;

function sendEvent(channel: 'events:executionLog' | 'events:deviceLog', event: LogEvent): void {
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
  ipcMain.handle('projects:rename', async (_event, payload: { folderId: string; name: string }) => renameProjectFolder(payload.folderId, payload.name));

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

  ipcMain.handle('execution:start', async (_event, payload: { testPath: string; testName: string }) =>
    startExecution(payload.testPath, payload.testName, (entry) => sendEvent('events:executionLog', entry))
  );
  ipcMain.handle('execution:stop', async (_event, payload: { runId: string }) => stopExecution(payload.runId));

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
