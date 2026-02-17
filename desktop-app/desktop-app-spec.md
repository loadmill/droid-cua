# droid-cua Desktop App Spec (Current Implementation)

This document is the **current implementation spec** for `/Users/idoco/Code/droid-cua/desktop-app`.
It replaces old mock/spec assumptions and reflects behavior implemented in code.

## 1. Product Scope (Implemented)

### In scope now
- Electron desktop app with React + TypeScript renderer.
- Native macOS-style window (`hiddenInset` title bar) and explicit drag/no-drag regions.
- Project-based test browsing using configured local folders.
- `.dcua` file lifecycle per project folder:
  - list, create, read, edit, save, rename, delete.
- Test execution using in-process CLI/core modules from Electron main.
- Live execution log streaming to renderer.
- Stop execution control with immediate local feedback.
- Device setup flow:
  - platform select (iOS/Android)
  - refresh list
  - connect to selected device
  - connection log stream and clear.
- Settings pane with workspace and config storage info.

### Explicitly deferred
- Full design/chat mode implementation.
- Persistent execution session history storage/replay.
- Git integration.
- Advanced attachments/settings UX.
- SQLite persistence (not used yet).

## 2. High-Level Architecture

- **Renderer**: UI state and interactions.
- **Preload**: typed `window.desktopApi` bridge.
- **Main process**: source of truth for filesystem, projects, device, execution, settings.
- **Workspace modules** are imported in-process (no subprocess parsing for core flows).

## 3. Runtime and Window Behavior

- Window created in main process with:
  - `titleBarStyle: 'hiddenInset'`
  - `trafficLightPosition: { x: 16, y: 14 }`
  - `minWidth: 1024`, `minHeight: 700`
- App shell has no dark outer frame.
- Drag behavior is controlled by `.drag-region` and `.no-drag` classes.

## 4. Workspace and Configuration

### Workspace resolution
- Workspace root is resolved by `resolveWorkspaceRoot()`:
  - `DROID_CUA_WORKSPACE` if set.
  - If running from `desktop-app`, parent repo root fallback.
  - Else current working directory.

### `.env`
- On app ready, main loads `<workspace>/.env` via `dotenv`.
- `OPENAI_API_KEY` is expected there (same source-of-truth behavior).

### Desktop config file
- Stored in Electron userData as `desktop-config.json`.
- Managed via `settings-service.ts`.

### Project folder storage schema
- Key: `projectFolders`.
- Value: array of entries; normalized to objects:
  - `{ path: string, alias?: string }`
- Backward compatibility:
  - string entries are migrated to object form.
  - legacy `name` field is treated as alias.

## 5. Projects Model (Current Decision)

- Sidebar section title is **`Projects`**.
- Projects are explicit folder entries from config (not auto-seeded).
- Each project has:
  - stable `id` derived from path hash,
  - `path`,
  - display `name = alias ?? basename(path)`,
  - `exists` + optional warning text.
- Missing folders remain visible and marked unavailable.

### Project folder actions
- Add folder: native OS directory picker.
- Open folder: from menu action:
  - macOS: `open <folder>`
  - fallback: `shell.openPath`.
- Edit name: updates **alias only** (never renames filesystem folder).
- Remove: removes folder entry from app config.

## 6. Test Discovery and File Semantics

- Discovery is **non-recursive** per project folder.
- Only direct `*.dcua` files are listed.

### Naming/validation rules
- Trim input.
- Normalize one `.dcua` extension (case-insensitive).
- Reject empty names.
- Reject path traversal / separators (`/`, `\\`, `..`).
- Reject illegal filename chars and control chars.
- Spaces are normalized to `-`.

### Duplicate handling on create
- Silent auto-suffix:
  - `name.dcua`, `name-2.dcua`, `name-3.dcua`, ...

### Rename behavior
- Rename is explicit (no auto-suffix).
- If target exists, returns error.

### Path safety
- All operations resolve path and enforce it remains under selected folder root.

## 7. Execution Behavior

### Start
- Runs selected test via `execution:start({ testPath, testName })`.
- Main imports and uses existing workspace modules:
  - `Session`, `ExecutionEngine`, `ExecutionMode`, prompt builder, logger.
- Requires connected device + deviceInfo.

### Live logs
- Execution outputs streamed to renderer via `events:executionLog`.
- Supported log kinds include: `user`, `assistant`, `reasoning`, `action`, `warning`, `info`, `error`, `success`, `system`, `muted`.

### Running identity and navigation
- Run identity is keyed by `(folderId, testName)`.
- User can navigate away and back while run is active.
- Returning to the running test shows current log stream state.
- Sidebar row shows spinner on the matching running test row only.

### Stop UX
- Stop request is immediate in UI:
  - stop controls switch to spinner/disabled state,
  - duplicate stop requests ignored while stopping.
- Immediate local line is appended:
  - `Stopping test execution — previously submitted actions may still occur.`
- Backend sets `mode.shouldStop = true`.
- Execution may still emit already-submitted actions before final stop line.

### Completion
- On finish, log includes `Execution finished: <file>`.
- Renderer clears active run state and stopping state when finish line is observed.
- App stays in execution view at run end (does not auto-switch to editor).

## 8. Device Setup Behavior

- `Devices` pane includes:
  - platform toggle (iOS / Android),
  - simulator/emulator picker,
  - Refresh and Connect actions,
  - Connection Log panel with Clear.
- Device refresh/connect logs stream via `events:deviceLog`.
- Connection state includes device metadata and resolution.
- Current action/layout placement (implemented):
  - platform controls and simulator selector are in the top setup card,
  - `Refresh` + `Connect` buttons are grouped on the bottom-right of that card,
  - connection logs are shown in a separate lower panel with its own `Clear` action.

## 9. Sidebar and Navigation UX

### Top branding
- Header row shows Loadmill logo (provided SVG) + text:
  - `Loadmill Droid-cua`.

### Main nav
- `New Test` visible but disabled with `Coming soon` badge.
- `Devices` and `Settings` entries are active.

### Projects section
- Label: `Projects`.
- Tighter row spacing to match Codex-like density.
- Per-folder row:
  - left icon toggles between folder/chevron behavior,
  - chevron appears on hover,
  - click toggles collapse/expand of that folder’s test list.
- Folder action buttons are icon-only, unframed, shown on hover.
- Folder menu (`...`) includes:
  - `Open`,
  - `Edit name`,
  - `Remove`.

### Test rows
- Full-width rows under folder.
- Fixed leading slot reserved for running spinner alignment.
- Right-click on test opens simple menu:
  - `Rename`, `Delete`.

## 10. Header UX (Main Pane)

- Single-line, flatter header.
- Left header text is a single row combining:
  - pane title
  - workspace/project label (when enabled for that pane)
- Header left text is constrained to never wrap to a second line (truncates instead).
- Shows pane title and (usually) workspace suffix inline.
- Editor title shows only selected test name (no `Test Code:` prefix).
- Device Setup hides workspace suffix text.
- Top-right `Command Menu` button is removed for now.

## 11. Dialog and Composer Behavior

### Dialogs
- Create test dialog targets selected folder context.
- Rename test dialog supports Enter submit.
- Folder alias edit dialog supports Enter submit.

### Bottom composer
- No divider above composer input.
- Slightly taller input area with subtle drop shadow.
- Round action button at right:
  - editor mode: up arrow submits revision apply,
  - execution mode: stop square (spinner while stopping).

### Enter key rule
- Enter submits forms/dialogs and editor composer (Shift+Enter keeps newline behavior where applicable).

## 12. IPC Contract (Current)

### Workspace
- `workspace:getCurrent() -> { rootPath, testsDir, workspaceName }`

### Projects
- `projects:list() -> ProjectFolder[]`
- `projects:add() -> ProjectFolder | null`
- `projects:setAlias({ folderId, alias }) -> ProjectFolder`
- `projects:open({ folderId }) -> void`
- `projects:remove({ folderId }) -> void`

### Tests
- `tests:list({ folderId }) -> ProjectTestFile[]`
- `tests:create({ folderId, requestedName }) -> { createdName, path }`
- `tests:read({ folderId, name }) -> { name, content, mtime }`
- `tests:save({ folderId, name, content }) -> { mtime }`
- `tests:rename({ folderId, fromName, requestedName }) -> { renamedName, path }`
- `tests:delete({ folderId, name }) -> void`
- `tests:applyRevision({ content, revisionPrompt }) -> { revisedContent }`

### Devices
- `devices:refresh({ platform }) -> DeviceOption[]`
- `devices:connect({ platform, deviceName }) -> ConnectionState`
- `devices:getState() -> ConnectionState`

### Execution
- `execution:start({ testPath, testName }) -> { runId }`
- `execution:stop({ runId }) -> { stopped: true }`

### Settings
- `settings:get() -> Record<string, unknown>`
- `settings:set(next) -> void`

### Event streams
- `events:executionLog`
- `events:deviceLog`

## 13. Known Current Notes

- `CommandMenuDialog` component and controller state still exist in code, but there is currently no visible trigger in the header.
- Project folder remove is config-only; no filesystem deletion is performed.
- “Edit name” refers to alias only, by design.

## 14. Source-of-Truth Principle

This file documents implemented behavior. If any previous spec (e.g. mock spec) conflicts with this document, this document is authoritative for the current desktop app build.
