import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { app } from 'electron';

const CONFIG_NAME = 'desktop-config.json';

async function getConfigPath(): Promise<string> {
  const userData = app.getPath('userData');
  await mkdir(userData, { recursive: true });
  return path.join(userData, CONFIG_NAME);
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const file = await getConfigPath();
  try {
    const content = await readFile(file, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function setSettings(next: Record<string, unknown>): Promise<void> {
  const file = await getConfigPath();
  await writeFile(file, JSON.stringify(next, null, 2), 'utf-8');
}
