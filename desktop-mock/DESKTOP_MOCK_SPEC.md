# Droid-CUA Desktop Mock: Product + UI Spec

This document defines the current **desktop-mock** spec and design decisions.
It is intended as implementation guidance for a coding agent.

## 1) Goal

Build a desktop experience for droid-cua that supports the core lifecycle:

1. connect a device,
2. design a test,
3. open/edit a created test,
4. run the test and monitor execution.

The mock should use a compact desktop layout with dense spacing, small readable typography, subtle neutral/blue surfaces, and clear interaction hierarchy, while reflecting droid-cua workflows from the CLI README.

## Run The Mock Web App

From repo root:

```bash
cd desktop-mock
npm install
npm run dev
```

If you are already in `desktop-mock`, run only:

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in terminal (usually `http://localhost:5173`).

Optional checks:

```bash
npm run typecheck
npm run build
```

## 2) Core Workflow (User-Centric)

1. User opens the app.
2. User goes to **Devices** and confirms platform/simulator connection in the connection log.
3. User moves to **New Test** and uses **Design Mode** (chat-style) to describe the scenario.
4. User saves a generated test.
5. User opens that test from the project tree (e.g. `ios-demo`) and edits the natural-language steps.
6. User runs the test and watches **Execution Mode** live logs.

## 3) Information Architecture

Single left sidebar + one main pane.

### Sidebar sections

- `New Test`
- `Devices`
- `Projects`
- `Settings` (bottom)

### Projects area behavior

- Project rows are **expand/collapse containers only** (not content destinations).
- Project rows use a small triangle expand/collapse toggle.
- **Only test rows are selectable**.
- Selecting a test must set/keep `New Test` context active internally, but `New Test` should **not** appear visually active if a specific test is selected.

## 4) Main Pane Modes

The main pane changes by context.

### A) Devices mode

Purpose: reflect CLI device-management flow without wizard complexity.

Contains:

- Platform selector (segmented control)
- Simulator selector (dropdown-like)
- Actions on right: `Refresh`, `Connect`
- Connection log block with `Clear`

Rules:

- No “Available Simulators” extra section.
- No plus/add-device button (devices assumed auto-detected).
- Keep connected device chip in header.
- Do not show refresh/connect duplicates in header.

### B) New Test mode (Design Mode)

Purpose: interactive creation flow (not execution).

Contains:

- Chat-style transcript
  - user messages on right in rounded gray bubble
  - assistant/reasoning/actions on left
- Intro card replacing raw terminal header lines:
  - Design Mode context title
  - brief instruction text
  - highlighted prompt (What do you want to test?)
- Composer styled exactly like execution/editor composer

Rules:

- No attachment chips/placeholders for now.
- No model/quality pills in composer.
- No plus button in composer.

### C) Selected test mode (Editor)

When a test is selected under a project, show test as editable multiline text.

Contains:

- Editable text area (natural-language steps, one per line)
- Actions: `Save`, `Delete`, `Run Test`
- Shared composer bar at bottom (same style as other modes)

Rules:

- Save updates in-app mock state.
- Delete removes test from project tree and clears selection.
- Run starts execution mode for selected test.

### D) Execution mode

Purpose: show running test session log.

Contains:

- Full session log view
- Stop button in header
- Shared composer bar

Rules:

- Composer helper text should be context-aware and not CLI-command-centric.

## 5) Header Behavior

Main pane top header should be compact:

- Title + project label on a single line (tight spacing)
- Chips for mode and connected device
- Actions contextually shown:
  - Devices: no duplicate top actions
  - Design: no run action unless a test is selected
  - Selected test: show run action in editor area
  - Execution: show stop action

## 6) Styling Guidelines (From This Session)

### Overall look

- Compact desktop-style UI
- Small, sharp typography
- Subtle blue tint across surfaces and controls
- Light visual hierarchy, avoid bulky boxes

### Sidebar

- Includes simulated macOS traffic lights above `New Test` in web mock
- Gentle gray/blue gradient shadow appears slightly below top (not at top edge)
- Project list uses small triangle expand/collapse

### Divider between sidebar and main pane

- Adjustable by drag
- Visual appearance should be a thin hairline
- No extra stripe/glow beside the line

### Composer

- Shared style across Design, Editor, Execution
- Keep controls minimal (mic + send)
- Contextual placeholder text by mode

### Density

- Reduce unnecessary inner rounded wrappers that waste space
- Main content should use available area efficiently

## 7) Naming / Content Decisions

- Example project renamed from `droid-cua` to `cua-example` (to avoid confusion with repo/app name).
- Example test remains `ios-demo`.

## 8) Electron Implementation Notes

Web mock simulates macOS traffic lights in React for layout preview.

For real Electron app, use native titlebar controls instead of fake buttons:

- Use BrowserWindow titlebar configuration (e.g. hidden/inset style on macOS).
- Keep renderer layout aligned under native chrome area.
- Avoid implementing fake close/minimize/zoom logic in React for production.

## 9) Out of Scope (Current Mock)

- Session history
- Git integration
- File attachment workflows
- Advanced analytics dashboards

## 10) Acceptance Checklist

A change is considered aligned if:

- Sidebar has only New Test / Devices / Projects / Settings
- Projects expand/collapse; only tests are selectable
- Selecting test opens editor first (not execution)
- Editor supports Save/Delete/Run
- Run switches to execution log mode
- New Test is design-only chat flow
- Devices pane reflects connect flow + connection log
- Shared composer appears consistently across modes
- Sidebar-main divider is draggable and visually a thin line
- Visual density and spacing remain compact and consistent with this spec
