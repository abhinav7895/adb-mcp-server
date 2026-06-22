# ADB MCP Server

[![npm version](https://img.shields.io/npm/v/adb-mcp-server.svg)](https://www.npmjs.com/package/adb-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Inspect, manage, debug, and run commands on connected Android devices and emulators — through natural language.

## Demo

![ADB MCP in action — capture device screens, view logs, query SQLite databases, and manage apps](assets/demo.png)

## Supported Features

### 📱 Devices & Networking

Manage connection, state, and port-forwarding rules of connected devices.

**Discovery** — List connected devices and emulators with models, products, and connection details.

**Wi-Fi Connections** — Connect and disconnect devices over TCP/IP (Wi-Fi).

**State & Reboot** — Check online/offline states and reboot into recovery or bootloader modes.

**Privilege Control** — Restart the ADB daemon with or without root privileges (`adb root`).

**Port Forwarding** — Forward local host ports to the device (`forward_port`) or reverse ports from the device to the host (`reverse_port`), critical for bundlers like React Native Metro.

---

### 📦 Apps

Install, run, and manage application packages.

**Install / Uninstall** — Install APKs from the host (supporting reinstall and downgrade flags) and uninstall packages.

**List & Filter** — List installed packages on the device, filtered by system, third-party, enabled, or disabled categories.

**Application Control** — Launch apps (either directly using a main activity path or triggering launcher intents) and force-stop packages.

**Permissions** — Grant or revoke runtime permissions dynamically on the fly.

---

### 📂 File Transfer

Move files to and from the Android filesystem.

**Push** — Copy local host files or folders onto the device.

**Pull** — Retrieve files or folders from the device filesystem back to the host.

---

### 📋 Logs & Diagnostics

Access debugging logs and capture device media.

**Logcat Logs** — Dump snapshots of recent system logs with custom limits and logcat tag/level filter criteria.

**Clear Logs** — Flush logcat buffers before running tests.

**Screenshots** — Capture device screen and return it directly as a renderable PNG image to the MCP client, or save it to a host path.

**Screen Recording** — Record screen videos as MP4 files (1 to 180 seconds) and pull them directly to the host machine.

**Diagnostics** — Run `dumpsys` diagnostics for any service (battery, cpuinfo, window) and read system properties (`getprop`).

**UI Hierarchy** — Dump screen layout tree XMLs (`dump_ui_hierarchy`) using uiautomator to allow the AI to inspect and locate on-screen components.

**Performance** — Read app memory RAM statistics (`get_app_memory`) and live device CPU load stats (`get_cpu_usage`).

---

### 🖱️ User Input Simulation

Automate actions and simulate user interactions on the screen.

**Taps & Swipes** — Tap coordinates (`tap_screen`) and perform swipes or drag-gestures (`swipe_screen`).

**Hardware Buttons** — Simulate hardware key presses (BACK, HOME, POWER, MENU, VOLUME) using `send_keyevent`.

**Text Input** — Type strings directly into focused input fields (`type_text`) with automatic space-escaping.

---

### 🗄️ Database & Storage Tools

Inspect SQLite database states and app configurations.

**Database Diagnostics** — Dump database statistics, open connections, query caches, and memory details using `dumpsys dbinfo`.

**SQLite Queries** — Run SQL commands (e.g. `SELECT`, `.tables`, `.schema`) directly on an app's sandboxed databases using `run-as` (requires a debuggable app or rooted environment, runs safely without host command injection).

**Shared Preferences** — List preferences files (`list_shared_preferences`) and read preference XML contents (`get_shared_preferences`) inside sandboxed apps.

---

### ⚙️ Raw Execution

Run low-level commands that are not exposed as high-level tools.

**Raw ADB** — Execute arbitrary ADB arguments as safe process argument arrays.

**Device Shell** — Run arbitrary shell commands directly inside the device.

---

## Quick Start

```json
{
  "mcpServers": {
    "adb": {
      "command": "npx",
      "args": ["-y", "adb-mcp-server"]
    }
  }
}
```

Ensure `adb` is installed on your machine and available in your shell `PATH`.

---

## Setup Instructions

### Claude Desktop

Config file path:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "adb": {
      "command": "npx",
      "args": ["-y", "adb-mcp-server"]
    }
  }
}
```

### Antigravity (Google AI IDE)

Config file path:
- **macOS/Linux**: `~/.gemini/config/mcp_config.json`

Add the server to your `mcp_config.json` under the `mcpServers` block:

```json
{
  "mcpServers": {
    "adb": {
      "command": "npx",
      "args": ["-y", "adb-mcp-server"]
    }
  }
}
```

Alternatively, configure via the UI:
1. Open the **Agent Panel** in the top right.
2. Select **Manage MCP Servers** or go to **Settings** → **Customizations**.
3. Add a custom MCP server:
   - **Command**: `npx`
   - **Arguments**: `-y adb-mcp-server`

### Cursor

1. Open **Settings** → **Features** → **MCP**
2. Click **+ Add New MCP Server**
3. Set:
   - **Name**: `adb`
   - **Type**: `command`
   - **Command**: `npx -y adb-mcp-server`

### Windsurf

Config file: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "adb": {
      "command": "npx",
      "args": ["-y", "adb-mcp-server"]
    }
  }
}
```

### VS Code (Cline / Roo Code)

Config file path:
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "adb": {
      "command": "npx",
      "args": ["-y", "adb-mcp-server"]
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add npx -- -y adb-mcp-server
```

---

## Example Prompts

```
List all connected Android devices. What are their model names?
```

```
Take a screenshot of my connected emulator and show it to me.
```

```
Install the app APK located at /Users/user/Downloads/app.apk and start its main activity.
```

```
Get the last 100 logcat lines from my device. Filter logs by "MyReactAppName" tag.
```

```
Run "SELECT * FROM settings WHERE value = 'dark';" on the database "app_prefs.db" inside the package "com.example.myapp".
```

```
Read the shared preferences file "user_settings" for package "com.example.myapp".
```

```
Press the power button on the device using keyevent.
```

```
Reverse port 8081 for React Native Metro bundler.
```

```
Dump the layout UI hierarchy XML of the current screen to inspect the visible components.
```

```
Tap the screen at coordinates (300, 750) and then type the text "hello world" into the input.
```

---

## License

MIT
