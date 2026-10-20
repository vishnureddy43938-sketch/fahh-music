# ⚡ HYDRA — Advanced Discord Music Bot & Dashboard

HYDRA is a modern, high-fidelity Discord music bot built with **Discord.js v14**, **lavalink-client**, **@discordjs/voice**, multi-source streaming audio extraction, SQLite persistence, and an optional **Express.js Web Dashboard** with Discord OAuth2 integration.

Designed with a sleek, dark cyber-aesthetic, HYDRA features interactive button controls, visual progress bars, robust queue management, 24/7 presence, prefix and slash commands, No-Prefix (NP) support, and centralized **Lavalink v4** node integration.

---

## ✨ Features

- **🎧 Lavalink Node Integration**: Configured for node `Lava Lenin` (`noi6.visihost.in:25591`) with automatic fallback to HYDRA's internal direct audio engine.
- **⚡ Dual Command Interfaces**: Run commands via Slash Commands (`/play`, `/pause`) or Prefix Commands (`.play`, `.pause`).
- **👑 No-Prefix (NP) System**: Authorized users and the permanent bot owner can invoke commands without typing the prefix.
- **🎛️ Interactive Now Playing Controls**: Real-time Discord button controls for `Previous`, `Pause/Resume`, `Skip`, `Stop`, `Loop`, `Volume (+/-)`, and `Queue Preview`.
- **📜 Thread-Safe Queue System**: FIFO queueing, Fisher-Yates shuffle, repeat modes (`off`, `track`, `queue`), history stack for instant `/previous` track replay, and paginated queue browsing.
- **🛠️ Owner-Only Node Diagnostics**: Safe telemetry reporting (`.node status`) displaying connection state, server version, and active players without exposing secrets.
- **⚙️ Persistent Server Settings**: SQLite database storing per-guild DJ roles, announcement channels, command-restricted channels, default volume, idle disconnect timeouts, 24/7 presence, and autoplay.
- **🌐 Optional Web Dashboard**: Modern dark-themed dashboard with Discord OAuth2 login, live player status, queue viewer, and server controls.
- **🛡️ Rock-Solid Reliability**: Anti-crash protections, interaction deferrals preventing 3-second timeouts, rate-limit awareness, and automatic voice reconnection.

---

## 📋 Command Reference (Prefix: `.` or Slash: `/`)

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `.play` / `/play` | `<query>` | Stream a track, playlist, or search query (SoundCloud, Spotify, YouTube, direct link) |
| `.search` / `/search` | `<query>` | Interactive search returning top results with a Discord select menu |
| `.pause` / `/pause` | *none* | Pause current playback |
| `.resume` / `/resume` | *none* | Resume paused playback |
| `.skip` / `/skip` | *none* | Skip the currently playing track |
| `.previous` / `/previous` | *none* | Replay the previous song from history |
| `.stop` / `/stop` | *none* | Stop playback, clear queue, and leave voice channel |
| `.queue` / `/queue` | `[page]` | Display paginated upcoming tracks with interactive navigation buttons |
| `.nowplaying` / `/nowplaying` | *none* | Show current song with live progress bar and control buttons |
| `.volume` / `/volume` | `[level]` | View or set volume between 1% and 150% with visual indicator |
| `.shuffle` / `/shuffle` | *none* | Randomize the order of upcoming tracks in queue |
| `.loop` / `/loop` | `[mode]` | Set repeat mode: `off`, `track` (repeat current song), `queue` (repeat all) |
| `.seek` / `/seek` | `<timestamp>` | Seek to timestamp in current track (e.g., `1:30`, `90`, `02:45`) |
| `.remove` / `/remove` | `<position>` | Remove a track from queue by position number |
| `.move` / `/move` | `<from> <to>` | Move a track to a different position in queue |
| `.clear` / `/clear` | *none* | Clear all upcoming tracks from queue without stopping playback |
| `.join` / `/join` | *none* | Connect HYDRA to your current voice channel |
| `.leave` / `/leave` | *none* | Disconnect HYDRA from the voice channel |
| `.lyrics` / `/lyrics` | `[song]` | Fetch formatted lyrics with clean pagination |
| `.247` / `/247` | *none* | Toggle continuous voice channel presence (disables auto-disconnect) |
| `.autoplay` / `/autoplay` | *none* | Toggle smart recommendations when queue finishes |
| `.node status` / `/node status`| *none* | **(Owner Only)** Display Lavalink node connection telemetry and health |
| `.noprefix` / `/noprefix` | `<action> ...` | **(Admin / Owner)** Manage No-Prefix execution permissions |
| `.settings` / `/settings` | `<action> ...` | Configure DJ roles, announcement channels, restricted channels, and defaults |
| `.help` / `/help` | `[command]` | Interactive manual with category dropdown and detailed usage guides |
| `.ping` / `/ping` | *none* | View Discord WebSocket ping, API round-trip, uptime, and voice stats |
| `.invite` / `/invite` | *none* | Generate an official bot invitation link with permission calculator |
| `.support` / `/support` | *none* | Get community support links and bug report resources |

---

## 🛠️ Prerequisites

- **Node.js**: `v20.x` LTS or newer ([Download Node.js](https://nodejs.org/))
- **npm**: `v10.x` or newer
- **Discord Bot Token & Client ID** ([Discord Developer Portal](https://discord.com/developers/applications))

---

## 🚀 Setup & Installation Guide

### Step 1: Create Your Discord Application & Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and enter `HYDRA`.
3. In the left sidebar, navigate to **Bot**:
   - Click **Reset Token** and copy your **Bot Token** (save this for `.env`).
   - Under **Privileged Gateway Intents**, enable:
     - ✅ **Message Content Intent** (Required for prefix commands like `.play`)
     - ✅ **Server Members Intent** (Recommended)
4. Navigate to **General Information**:
   - Copy the **Application ID / Client ID** (save this for `.env`).

---

### Step 2: Configure Environment Variables

Create your `.env` file from [.env.example](file:///c:/Users/EREN%27s%20PC/Documents/hydra%20music/.env.example):

#### Windows (PowerShell):
```powershell
Copy-Item .env.example .env
notepad .env
```

#### Linux / macOS:
```bash
cp .env.example .env
nano .env
```

Configure your credentials and Lavalink node:
```env
# Discord Credentials
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here

# Bot Owner & Prefix Configuration
OWNER_ID=1545399010444185681
BOT_PREFIX=.
SUPPORT_SERVER_URL=https://discord.gg/U465TGfT9Z

# Lavalink Node Configuration
NODE_URL=noi6.visihost.in:25591
NODE_NAME=Lava Lenin
NODE_AUTH=your_lavalink_password_here
NODE_SECURE=false

# Optional Development Guild (Instant Slash Command Updates)
GUILD_ID=
```

> **Note on `NODE_AUTH`**:
> If `NODE_AUTH` is missing or unconfigured, the bot will display a clear startup notice and keep the internal audio engine active. The password is never logged, printed, or exposed in diagnostics.

---

### Step 3: Install Dependencies & Run Tests

```bash
npm install
npm test
```
All **62 automated unit tests** will run and verify:
- Boolean configuration parsing (`parseBoolean`)
- Lavalink URL normalization & SSL scheme mapping (`parseLavalinkUrl`)
- Owner & No-Prefix access controls
- Node diagnostics credential security
- Queue mechanics, loops, shuffle, time formatters, and database operations

---

### Step 4: Register Slash Commands

Deploy commands to Discord:
```bash
npm run deploy
```

---

### Step 5: Start HYDRA

```bash
npm start
```

Startup banner:
```
  ==============================================================
   ⚡ HYDRA MUSIC BOT • HIGH FIDELITY AUDIO SYSTEM
  ==============================================================
   Node.js:  v20.20.2
   Version:  1.0.0
   Prefix:   .
   Owner ID: 1545399010444185681
   Node:     Lava Lenin (noi6.visihost.in:25591)
  ==============================================================
```

Join a voice channel and run:
```
.play lofi beats
```
or
```
/play lofi beats
```

---

## 👑 No-Prefix (NP) Access System

Users with No-Prefix authorization can run music commands directly without typing `.`:
```
play faded
pause
skip
```

### Managing No-Prefix Users (Owner & Admins):
- Grant Global NP (Owner only):
  ```
  .noprefix add @user global
  ```
- Grant Server NP (Admins & Owner):
  ```
  .noprefix add @user server
  ```
- Revoke NP:
  ```
  .noprefix remove @user [global|server]
  ```
- List authorized NP users:
  ```
  .noprefix list
  ```

---

## 🛠️ Owner Node Diagnostics (`.node status`)

The bot owner (`OWNER_ID=1545399010444185681`) can inspect real-time Lavalink node health:
```
.node status
```
Outputs telemetry including:
- Configured Node Name (`Lava Lenin`)
- Endpoint (`noi6.visihost.in:25591`)
- Connection State (`CONNECTED`, `CONNECTING`, `DISCONNECTED`)
- Server Version
- Active Player Count
- Node CPU & Memory Load
- Node Uptime & Reconnect Attempts
*(Credentials and passwords are strictly hidden)*

Non-owner users running `.node status` receive only a public playback availability indicator.

---

## 🐳 Docker Deployment

Run with Docker Compose:
```bash
docker compose up -d
docker compose logs -f hydra
```

---

## 🛡️ License

This project is licensed under the ISC License.
