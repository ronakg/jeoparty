<p align="center">
  <img src="public/logo.svg" alt="JeoPARTY! Logo" width="160" />
</p>

# ⚡ JeoPARTY!

> The high-energy, local-first trivia game show built for living rooms,
> classrooms, game nights, and company socials.

JeoPARTY! turns any laptop and TV into an authentic, TV-ready game show.
Hook your computer up to a projector or big screen, grab your phone or
laptop to host, and run custom trivia rounds with synchronized media,
dramatic rebounds, and victory confetti.

---

## ✨ Features

- 📺 **Stage-Ready Player Display**
  - Designed for projectors and big screens with zero player clicks needed.
  - Sapphire-blue boards, gold typography, and smooth animations.
  - Giant live team scoreboards with buzzer and celebration banners.

- 📱 **Dual-Screen or Mobile Host Console**
  - Host from your laptop or scan a stylized QR code to drive the game
    straight from your smartphone over your local Wi-Fi.
  - Real-time previews of upcoming clues and answers.
  - Quick action controls: hint reveal, media playback, score override,
    and instantaneous action undo.

- 🎬 **Dynamic Multimedia Engine**
  - Clues with YouTube clips, local video, audio with live waveforms,
    and high-res images.
  - Host controls media playback with synchronized playback on the stage.

- ⚡ **Party-Tested Game Rules**
  - Automatic turn alternation between competing teams.
  - Misses give the opposing team a **50% Rebound Opportunity**.
  - Hints reveal clues for a small point deduction.
  - Daily Doubles and high-stakes Final Jeopardy secret wagers.

- 🛠️ **In-App Game Builder**
  - Visual editor to craft custom categories, clues, and point values.
  - Save and load game packs in clean YAML and JSON formats.

---

## 🚀 Download & Installation

Grab the pre-packaged installer for your system from GitHub Releases:

### macOS (Apple Silicon & Intel)

1. Download `JeoParty-<version>-arm64.dmg` (Apple Silicon) or
   `JeoParty-<version>-x64.zip` (Intel).
2. For `.dmg`, open and drag `JeoPARTY` into `/Applications`. For `.zip`,
   extract and move `JeoPARTY.app` into `/Applications`.
3. **First launch (Gatekeeper)**: Since this package is community-built
   without an Apple Developer certificate, right-click `JeoPARTY.app`
   in Finder and select **Open**, or run:
   ```bash
   xattr -cr /Applications/JeoPARTY.app
   ```

### Windows (x64)

1. Download `JeoParty-<version>-x64.exe`.
2. Run the installer to create a desktop shortcut and Start Menu entry.
3. **SmartScreen Prompt**: Click **More info** followed by **Run anyway**.

---

## 💻 Running from Source

Requirements: Node.js 20+ (Node 24 recommended) and npm.

```bash
# Clone the repository
git clone https://github.com/ronakg/jeoparty.git
cd jeoparty

# Install dependencies
npm install

# Launch Electron desktop app (Dual Windows)
npm run electron:dev
```

### Browser Mode

Run without Electron directly in any modern browser:

```bash
npm run dev
```

- **Host Console**: `http://localhost:5173/?view=admin`
- **Player Board**: `http://localhost:5173/?view=display`

Tabs synchronize instantly via `BroadcastChannel` and `localStorage`.

---

## 🧪 Testing

Run the automated test suite:

```bash
npm test
```

---

## 📜 License

Distributed under the [MIT License](LICENSE). Copyright (c) 2026 Ronak Gandhi.
