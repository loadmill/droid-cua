# desktop-mock

Browser-first React mock UI for droid-cua desktop design iteration.

## Run

```bash
cd desktop-mock
npm install
npm run dev
```

Open the local Vite URL in your browser.

## Current scope

- Single left sidebar with compact icon actions
- Sidebar options: New Test, Devices, Projects dropdown, Settings
- Main center pane focused on current droid-cua terminal-like session output
- Project selection in sidebar updates active session/device context

## Notes

- Uses static mock data and typed interfaces in `src/types.ts`.
- Component structure is renderer-safe so it can be reused in a future Electron app.
