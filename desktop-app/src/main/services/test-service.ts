import path from 'node:path';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import type { CreateResult, ProjectTestFile, RenameResult, SaveResult, TestContent } from '../../preload/types';
import { importWorkspaceModule } from './module-loader';

const ILLEGAL_FILENAME_PATTERN = /[<>:"|?*\x00-\x1F]/;

function normalizeNameOrThrow(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Name is required.');
  }

  const noExt = trimmed.replace(/\.dcua$/i, '');
  if (!noExt) {
    throw new Error('Name is required.');
  }

  if (noExt.includes('/') || noExt.includes('\\') || noExt.includes('..')) {
    throw new Error('Invalid name. Path separators are not allowed.');
  }

  if (ILLEGAL_FILENAME_PATTERN.test(noExt)) {
    throw new Error('Invalid name. Contains unsupported filename characters.');
  }

  const base = noExt.replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  if (!base) {
    throw new Error('Invalid name.');
  }

  return `${base}.dcua`;
}

function ensureWithinFolder(folderPath: string, filename: string): string {
  const resolvedFolder = path.resolve(folderPath);
  const resolved = path.resolve(folderPath, filename);
  if (!resolved.startsWith(`${resolvedFolder}${path.sep}`)) {
    throw new Error('Invalid path.');
  }
  return resolved;
}

async function ensureFolderExists(folderPath: string): Promise<void> {
  await mkdir(folderPath, { recursive: true });
}

async function nextAvailableFilename(folderPath: string, baseFilename: string): Promise<string> {
  const normalized = baseFilename.replace(/\.dcua$/i, '');

  let candidate = `${normalized}.dcua`;
  let i = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await stat(path.join(folderPath, candidate));
      candidate = `${normalized}-${i}.dcua`;
      i += 1;
    } catch {
      return candidate;
    }
  }
}

export async function listTests(folderId: string, folderPath: string): Promise<ProjectTestFile[]> {
  let files: string[] = [];
  try {
    files = await readdir(folderPath);
  } catch {
    return [];
  }

  const dcuaFiles = files.filter((file) => file.toLowerCase().endsWith('.dcua'));
  const tests = await Promise.all(
    dcuaFiles.map(async (filename) => {
      const fullPath = path.join(folderPath, filename);
      const [content, fileStat] = await Promise.all([readFile(fullPath, 'utf-8'), stat(fullPath)]);

      return {
        folderId,
        name: filename.replace(/\.dcua$/i, ''),
        filename,
        path: fullPath,
        lines: content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0).length,
        modified: fileStat.mtime.toISOString()
      } satisfies ProjectTestFile;
    })
  );

  return tests.sort((a, b) => (a.modified < b.modified ? 1 : -1));
}

export async function createTest(folderPath: string, requestedName: string): Promise<CreateResult> {
  await ensureFolderExists(folderPath);
  const normalizedFilename = normalizeNameOrThrow(requestedName);
  const filename = await nextAvailableFilename(folderPath, normalizedFilename);
  const fullPath = ensureWithinFolder(folderPath, filename);
  await writeFile(fullPath, '', 'utf-8');
  return {
    createdName: filename,
    path: fullPath
  };
}

export async function readTest(folderPath: string, name: string): Promise<TestContent> {
  const filename = normalizeNameOrThrow(name);
  const fullPath = ensureWithinFolder(folderPath, filename);
  const [content, fileStat] = await Promise.all([readFile(fullPath, 'utf-8'), stat(fullPath)]);

  return {
    name: filename,
    content,
    mtime: fileStat.mtime.toISOString()
  };
}

export async function saveTest(folderPath: string, name: string, content: string): Promise<SaveResult> {
  const filename = normalizeNameOrThrow(name);
  const fullPath = ensureWithinFolder(folderPath, filename);
  await writeFile(fullPath, content, 'utf-8');
  const fileStat = await stat(fullPath);

  return { mtime: fileStat.mtime.toISOString() };
}

export async function deleteTest(folderPath: string, name: string): Promise<void> {
  const filename = normalizeNameOrThrow(name);
  const fullPath = ensureWithinFolder(folderPath, filename);
  await unlink(fullPath);
}

export async function renameTest(folderPath: string, fromName: string, requestedName: string): Promise<RenameResult> {
  const sourceFilename = normalizeNameOrThrow(fromName);
  const targetFilename = normalizeNameOrThrow(requestedName);

  if (sourceFilename.toLowerCase() === targetFilename.toLowerCase()) {
    return {
      renamedName: targetFilename,
      path: ensureWithinFolder(folderPath, targetFilename)
    };
  }

  const sourcePath = ensureWithinFolder(folderPath, sourceFilename);
  const targetPath = ensureWithinFolder(folderPath, targetFilename);

  try {
    await stat(targetPath);
    throw new Error('A test with that name already exists.');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code && err.code !== 'ENOENT') {
      throw error;
    }
  }

  await rename(sourcePath, targetPath);
  return {
    renamedName: targetFilename,
    path: targetPath
  };
}

export async function applyRevisionToContent(content: string, revisionPrompt: string): Promise<string> {
  const prompt = revisionPrompt.trim();
  if (!prompt) {
    throw new Error('Revision prompt is required.');
  }

  const { reviseTestScript } = await importWorkspaceModule<{
    reviseTestScript: (originalScript: string, revisionRequest: string) => Promise<string>;
  }>('src/device/openai.js');

  return await reviseTestScript(content, prompt);
}
