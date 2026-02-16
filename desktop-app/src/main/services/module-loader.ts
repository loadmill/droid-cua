import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveWorkspaceRoot } from './workspace';

export async function importWorkspaceModule<T = unknown>(relativeModulePath: string): Promise<T> {
  const absolutePath = path.join(resolveWorkspaceRoot(), relativeModulePath);
  const moduleUrl = pathToFileURL(absolutePath).href;
  return (await import(moduleUrl)) as T;
}

