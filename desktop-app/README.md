# droid-cua desktop-app (v1)

Electron desktop implementation for droid-cua v1.

## Scope in v1

- Single workspace
- Tests from `./tests/*.dcua`
- Create/select/edit/save/delete tests
- Run selected test with live execution logs
- Device refresh/connect UI with connection log
- `New Test` is visible but disabled (Coming soon)

## Run

```bash
cd /Users/idoco/Code/droid-cua/desktop-app
npm install
npm run dev
```

## Notes

- Workspace defaults to repo root in dev via `DROID_CUA_WORKSPACE=..`.
- `OPENAI_API_KEY` is loaded from `<workspace>/.env`.
- Desktop settings persist in Electron userData as `desktop-config.json`.
