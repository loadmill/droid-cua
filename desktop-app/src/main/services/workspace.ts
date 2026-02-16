import path from 'node:path';
import { existsSync } from 'node:fs';

export interface WorkspaceInfo {
  rootPath: string;
  testsDir: string;
  workspaceName: string;
}

export function resolveWorkspaceRoot(): string {
  const raw = process.env.DROID_CUA_WORKSPACE;
  if (raw) {
    return path.resolve(process.cwd(), raw);
  }

  const cwd = process.cwd();
  if (path.basename(cwd) === 'desktop-app') {
    const parent = path.resolve(cwd, '..');
    if (existsSync(path.join(parent, 'src')) && existsSync(path.join(parent, 'package.json'))) {
      return parent;
    }
  }

  return cwd;
}

export function getWorkspaceInfo(): WorkspaceInfo {
  const rootPath = resolveWorkspaceRoot();
  return {
    rootPath,
    testsDir: path.join(rootPath, 'tests'),
    workspaceName: path.basename(rootPath)
  };
}
