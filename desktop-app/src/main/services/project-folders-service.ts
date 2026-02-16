import path from 'node:path';
import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import type { ProjectFolder } from '../../preload/types';
import { getSettings, setSettings } from './settings-service';

const PROJECT_FOLDERS_KEY = 'projectFolders';

interface StoredProjectFolder {
  path: string;
  name?: string;
}

function normalizeFolderPath(rawPath: string): string {
  return path.resolve(rawPath.trim());
}

function folderIdForPath(folderPath: string): string {
  return createHash('sha1').update(folderPath).digest('hex').slice(0, 12);
}

function folderNameForPath(folderPath: string): string {
  const base = path.basename(folderPath);
  return base || folderPath;
}

async function folderExists(folderPath: string): Promise<boolean> {
  try {
    const folderStat = await stat(folderPath);
    return folderStat.isDirectory();
  } catch {
    return false;
  }
}

async function getStoredFolders(): Promise<StoredProjectFolder[]> {
  const settings = await getSettings();
  const value = settings[PROJECT_FOLDERS_KEY];
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: StoredProjectFolder[] = value
    .map((item) => {
      if (typeof item === 'string') {
        return { path: normalizeFolderPath(item) } satisfies StoredProjectFolder;
      }
      if (item && typeof item === 'object' && typeof (item as { path?: unknown }).path === 'string') {
        const typed = item as { path: string; name?: unknown };
        return {
          path: normalizeFolderPath(typed.path),
          name: typeof typed.name === 'string' ? typed.name.trim() || undefined : undefined
        } satisfies StoredProjectFolder;
      }
      return null;
    })
    .filter((item): item is StoredProjectFolder => item !== null);

  const deduped = Array.from(new Map(normalized.map((item) => [item.path, item])).values());
  if (JSON.stringify(deduped) !== JSON.stringify(value)) {
    await setStoredFolders(deduped);
  }

  return deduped;
}

async function setStoredFolders(folders: StoredProjectFolder[]): Promise<void> {
  const settings = await getSettings();
  await setSettings({
    ...settings,
    [PROJECT_FOLDERS_KEY]: folders
  });
}

function toProjectFolder(stored: StoredProjectFolder, exists: boolean): ProjectFolder {
  return {
    id: folderIdForPath(stored.path),
    path: stored.path,
    name: stored.name || folderNameForPath(stored.path),
    exists,
    warning: exists ? undefined : 'Folder unavailable'
  };
}

export async function listProjectFolders(): Promise<ProjectFolder[]> {
  const stored = await getStoredFolders();
  return await Promise.all(
    stored.map(async (folder) => {
      const exists = await folderExists(folder.path);
      return toProjectFolder(folder, exists);
    })
  );
}

export async function addProjectFolder(folderPath: string): Promise<ProjectFolder> {
  const normalizedPath = normalizeFolderPath(folderPath);
  const current = await getStoredFolders();
  if (!current.some((entry) => entry.path === normalizedPath)) {
    await setStoredFolders([...current, { path: normalizedPath }]);
  }

  const exists = await folderExists(normalizedPath);
  return toProjectFolder({ path: normalizedPath }, exists);
}

export async function renameProjectFolder(folderId: string, name: string): Promise<ProjectFolder> {
  const nextName = name.trim();
  if (!nextName) {
    throw new Error('Folder name is required.');
  }

  const current = await getStoredFolders();
  const next = current.map((folder) => (folderIdForPath(folder.path) === folderId ? { ...folder, name: nextName } : folder));
  await setStoredFolders(next);

  const renamed = next.find((folder) => folderIdForPath(folder.path) === folderId);
  if (!renamed) {
    throw new Error('Project folder not found.');
  }

  const exists = await folderExists(renamed.path);
  return toProjectFolder(renamed, exists);
}

export async function removeProjectFolder(folderId: string): Promise<void> {
  const current = await getStoredFolders();
  const next = current.filter((folder) => folderIdForPath(folder.path) !== folderId);
  await setStoredFolders(next);
}

export async function getProjectFolderById(folderId: string): Promise<ProjectFolder | null> {
  const folders = await listProjectFolders();
  return folders.find((folder) => folder.id === folderId) ?? null;
}
