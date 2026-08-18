# TDSH Client Plugins

Four client-side dsh plugins implementing the zero-preload HTTP-carrier architecture (no Electron `contextBridge` — client plugins fetch from the in-app HTTP server).

| Plugin | Description |
|---|---|
| [dsh-version-label](./dsh-version-label) | Display TDSH app version in bottom-right corner |
| [dsh-window-controls](./dsh-window-controls) | Window chrome: drag strip + minimize/maximize/close pill |
| [dsh-session-log](./dsh-session-log) | Session log redirect: hide header button + inject settings entry |
| [dsh-update-btn](./dsh-update-btn) | Update check/download/install button (blue arrow, bottom-right) |

## Install

Each plugin is a dsh bundle. Add to a dsh profile's `package.json` dependencies and `dsh.profile.bundles` array:

```json
"dsh-version-label": "github:tuantuan0218/TDSH#main&path:dsh-plugins/dsh-version-label",
"dsh-window-controls": "github:tuantuan0218/TDSH#main&path:dsh-plugins/dsh-window-controls",
"dsh-session-log": "github:tuantuan0218/TDSH#main&path:dsh-plugins/dsh-session-log",
"dsh-update-btn": "github:tuantuan0218/TDSH#main&path:dsh-plugins/dsh-update-btn"
```

Then `pnpm install` in the profile directory.