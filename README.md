<div align="center">
  <img src="./public/images/logo.png" width="120" alt="logo">
  <h1>DeepSeek Harness Desktop</h1>
  <p>A desktop client for DeepSeek Harness, built with Electron 39 + Vue 3 + Naive UI</p>
  <p>
    English &nbsp;|&nbsp; <a href="README.zh-CN.md">简体中文</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" alt="platform">
    <img src="https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white" alt="Electron">
    <img src="https://img.shields.io/badge/Vue-3-42B883?logo=vue.js&logoColor=white" alt="Vue">
    <img src="https://img.shields.io/badge/Naive%20UI-3-18A058" alt="Naive UI">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="license">
  </p>
</div>

---

## Project Positioning

DeepSeek Harness Desktop is a cross-platform desktop client built on the **Electron 39 + Vue 3 + Naive UI** stack, using the ElectronEgg (ee-core) framework to organize main-process lifecycle and automatic IPC loading. The app bundles a Node.js 24.18.1 LTS runtime, hosts the official `@deepseek-ai/dsh` as a subprocess, and loads its `dsh web` UI inside a sandboxed BrowserWindow.

Compared to running `npx @deepseek-ai/dsh web` directly, this project packages the entire workflow — installing Node, configuring npm, opening a terminal, managing the process — into a regular desktop app that users can launch with a double-click.

> This is a community-maintained project with no affiliation to DeepSeek. The app does not modify any code, data, or behavior of the official DSH; DSH runs under its own license.

## Key Features

### Runtime Hosting

- **Bundled Node.js 24.18.1 LTS**: shipped with the app, no need to install Node.js separately
- **Process isolation**: DSH runs as an independent subprocess, automatically reaped on app exit
- **Random port allocation**: DSH listens on `--port 0`; the actual address is parsed from stdout to avoid port conflicts

### Version Management

- **Multi-version coexistence**: each version lives in its own directory; install and switch between any historical versions
- **Atomic installation**: npm install writes to a staging directory first, then renames atomically after validation — no half-installed versions
- **Real-time install progress**: npm output is streamed to the frontend — no more black-box waiting

### Registry Switching

- **One-click toggle**: switch between the official npm registry and the China npmmirror mirror
- **Persisted preference**: the choice is saved to the user data directory and restored on restart
- **Dual-channel sync**: version catalog queries and npm install share the same registry URL

### System Tray

- **Close-to-tray**: clicking the window's close button hides it to the tray instead of quitting; the DSH process keeps running
- **Tray menu**: three items — DeepSeek Harness / Version Manager / Quit
- **Status indicator**: tray tooltip reflects the DSH running state and version in real time

### Bilingual Localization

- **One-click switch**: UI, menus, tray, error messages, and notifications are all localized
- **Follow system**: optional locale that follows the system language, auto-adapted on app launch

### App Self-Update

- **DSH updates**: the latest version is highlighted in the list; click **Update to vX.X.X** to install or switch
- **App updates**: checks GitHub Releases for new versions of the app itself

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Renderer Process (Vue 3)               │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Version Manager (Naive UI)                      │   │
│  │  - Version card grid / install progress /        │   │
│  │    registry switch / language switch             │   │
│  │  - Reactive state management (reactive)          │   │
│  │  - i18n en/zh copy                               │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ contextBridge (controlled API)
                         │ window.dshDesktop.*
┌────────────────────────▼────────────────────────────────┐
│                 Main Process (Electron 39)               │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Bundled     │  │ Version      │  │ Process        │ │
│  │ Node.js     │  │ Manager      │  │ Supervisor     │ │
│  │ 24.18.1 LTS      │  │ npm install  │  │ spawn dsh web  │ │
│  │             │  │ switch/verify│  │ parse port     │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ System Tray │  │ App Updater  │  │ IPC Registry   │ │
│  │ menu/tooltip│  │ electron-    │  │ ipcMain.handle │ │
│  │             │  │ updater      │  │                │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ BrowserWindow.loadURL
                         │ http://127.0.0.1:random port
┌────────────────────────▼────────────────────────────────┐
│              DSH Window (sandboxed)                      │
│                                                          │
│  Official dsh web page                                   │
│  - contextIsolation: true                                │
│  - sandbox: true                                         │
│  - No Electron / Node.js API exposed                     │
└─────────────────────────────────────────────────────────┘
```

The main process exposes a controlled API (`window.dshDesktop`) to the version manager renderer via `contextBridge.exposeInMainWorld`; the DSH window only loads a local 127.0.0.1 URL with no preload script injection.

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Desktop framework | Electron 39 | Cross-platform desktop runtime |
| App framework | ee-core (ElectronEgg) | Main-process lifecycle, IPC auto-loading, config layering |
| Frontend framework | Vue 3 + Vite | Renderer UI with hot reload |
| UI library | Naive UI | Version manager UI components |
| Runtime | Node.js 24.18.1 LTS | Bundled runtime for DSH subprocess |
| State management | Vue reactive | Lightweight reactivity (no Pinia) |
| Version comparison | semver | DSH version validation and sorting |
| App updater | electron-updater | GitHub Releases check and install |
| Persistence | write-file-atomic | Atomic config file writes |
| Process management | child_process.spawn | DSH subprocess start/stop and stdout monitoring |

## Usage Guide

### Starting DSH

1. Open the app and enter the version manager page
2. Select an installed DSH version from the version card grid (the latest installed version is selected by default)
3. Click the **Start DSH** button — the app launches the `dsh web` subprocess via the bundled Node.js
4. Once started, the DeepSeek Harness workspace opens in a dedicated window, and the main window auto-hides to the system tray

### Version Management

- **Install a new version**: click **Install** on a version card; the app downloads the official package via npm to the user data directory, with npm output shown in real time
- **Switch versions**: one-click switch between installed versions (stop the running DSH first)
- **Registry switch**: toggle between the official npm registry / China mirror (npmmirror) from the top toolbar; users in mainland China should use the mirror for faster downloads
- **Quick update**: when a newer version is detected, an **Update to vX.X.X** button appears at the top — click to install or switch

### Tray Menu

After launch, a tray icon appears. Right-click to access three items:

| Menu item | Action |
| --- | --- |
| DeepSeek Harness | Show the DSH workspace window (available while DSH is running) |
| Version Manager | Show the version manager main window |
| Quit | Quit the app; any running DSH process is stopped automatically |

Single-click the tray icon: shows the DSH workspace window if available, otherwise the main window.

## Download & Install

Grab the installer for your system from [GitHub Releases](https://github.com/westhack/deepseek-harness-desktop/releases/latest):

| System | Installer |
| --- | --- |
| macOS Apple Silicon | `*-arm64.dmg` |
| macOS Intel | `*-x64.dmg` |
| Windows 10/11 x64 | `*-Setup-x64.exe` |

DSH install location (does not pollute the global environment):

| System | Path |
| --- | --- |
| macOS | `~/Library/Application Support/dsh-desktop/dsh-versions/` |
| Windows | `%APPDATA%\dsh-desktop\dsh-versions\` |

Each version lives in its own subdirectory. Delete the directory to uninstall that version.

## Local Development

### Prerequisites

- Node.js 22.19+ or 24+
- npm 10+
- macOS 11+ or Windows 10+

### Dev mode

```bash
npm install
npm run prepare:runtime   # download bundled Node.js 24 and DSH
npm run dev               # launch Electron + frontend hot reload
```

### Build

```bash
npm run build-m-arm64     # macOS Apple Silicon
npm run build-m           # macOS Intel
npm run build-w           # Windows x64
```

Build artifacts are written to `build/out/`.

## Project Structure

```
electron-egg/
├── electron/                          # Electron main process
│   ├── config/
│   │   └── config.default.js          # app config (sandbox, window, lifecycle)
│   ├── preload/
│   │   ├── bridge.js                  # DSH API bridge (contextBridge, controlled API)
│   │   └── lifecycle.js               # app lifecycle preload
│   ├── service/
│   │   ├── dsh/
│   │   │   ├── manager.js             # main manager: windows, tray, menu, IPC
│   │   │   ├── controller.js          # business orchestration: version select, start/stop, registry
│   │   │   ├── version-manager.js     # npm install, version resolution, atomic install
│   │   │   ├── dsh-supervisor.js      # DSH subprocess spawn, stdout parsing, exit handling
│   │   │   ├── registry.js            # npm catalog query
│   │   │   ├── state-store.js         # config persistence (write-file-atomic)
│   │   │   ├── runtime-paths.js       # bundled Node.js path resolution
│   │   │   ├── network-proxy.js       # network proxy detection and config
│   │   │   └── menu-copy.js           # en/zh menu and tray copy
│   │   └── desktop-updater.js         # app self-update (electron-updater)
│   └── shared/
│       ├── contracts.js               # shared constants & validation (version, locale, registry)
│       └── ipc-channels.js            # IPC channel constants
├── frontend/                          # Vue 3 frontend
│   └── src/
│       ├── views/dsh/
│       │   └── Manager.vue            # version manager page (Naive UI)
│       ├── store/dsh.js               # reactive state management
│       ├── utils/i18n.js              # en/zh copy and localization utils
│       └── router/                    # route config
├── public/                            # static assets (logo, etc.)
├── build-resources/                   # build resources (bundled Node.js, DSH)
└── scripts/                           # build helper scripts
```

## Product Boundaries

This project only takes responsibility for runtime management, version management, and process hosting. It will never:

- Fork, patch, recompile, or inject code into the official DSH page
- Manage API keys, models, sessions, plugins, Skills, or MCP configuration
- Read, migrate, back up, or delete DSH user data
- Auto-upgrade or forcibly replace a DSH version chosen by the user
- Expose the local DSH service to the LAN or public internet (listens on 127.0.0.1 only)

## License

[Apache License 2.0](LICENSE)

## Acknowledgements

- [DeepSeek](https://www.deepseek.com/) — the developers of the official DeepSeek Harness
- [ElectronEgg](https://github.com/wallace5303/electron-egg) — the desktop application development framework
- [Vue.js](https://vuejs.org/) & [Naive UI](https://www.naiveui.com/) — the frontend framework and component library
