# Local Jeopardy Game (Desktop & Browser)

A local-first, offline Jeopardy game packaged for macOS (and cross-platform) built with **Electron**, **React**, **TypeScript**, and **Tailwind CSS**.

Featuring two synchronized interfaces:
1. **Admin Host Console**: Run on your laptop screen. Gives the host complete control over round navigation, advance clue/answer views, clue activation, media reveal and playback sync, hint release, answer judging with rebounds, score overrides, and game authoring.
2. **Player Display Board**: Run on a second screen, projector, or TV. Features authentic Jeopardy styling, blue grid, golden typography, clue overlays, synced media players, and big team scoreboards with zero required player mouse interaction.

---

## Quick Start

### 1. Launch with Electron (Dual Desktop Windows)
```bash
npm run electron:dev
```
* This launches both the **Admin Host Window** and the **Player Display Board** simultaneously.
* Drag the **Player Display Board** to your projector or second monitor and press `F` (or the maximize icon) to make it full screen.

### 2. Launch in Browser (Alternative Web Mode)
You can also run it directly in your browser without packaging:
```bash
npm run dev
```
* **Host Admin Console**: Open `http://localhost:5173/?view=admin`
* **Player Board**: Open `http://localhost:5173/?view=display` on your external monitor
* Both tabs synchronize state instantly via the `BroadcastChannel` and `localStorage` engine with zero latency!

---

## Key Gameplay Rules & Features

- **2 Teams**: Custom team names configured in settings (defaults: "Champions" vs "Challengers").
- **Turn Control**: Host selects which team has the board or answers first (decided offline).
- **Correct Answer**: Awards the current clue points to the answering team.
- **Incorrect Answer**: No point deductions! The other team automatically gets a **Rebound Opportunity** to answer for **50% of the clue points**.
- **Hints**: Host can click "Reveal Hint" when requested by a team. Revealing the hint reduces available points by a configurable amount (default: $200). Hints are always text.
- **Media Engine**:
  - Supports **Local Images**, **Local Audio** (MP3/WAV with animated waveform), **Local Video** (MP4/WebM), and **YouTube URLs**.
  - Clues with media remain hidden until the Host clicks **Reveal Media**.
  - Host has play/pause/replay controls that synchronize directly to the player board.
- **Host Tools**:
  - Advance preview of questions and answers.
  - Manual score adjustment modal.
  - **Undo** button to rollback accidental clicks.
  - Round switcher (Round 1, Round 2, Final Jeopardy).
- **Final Jeopardy**:
  - Category reveal.
  - Offline secret wager entry.
  - Clue reveal.
  - Final response judging and confetti celebration for the winning team!
- **In-App Game Builder**:
  - Visually create, edit, add, or delete rounds, categories, clues, and point values.
  - Native **Save to JSON** and **Load from JSON** files.

---

## Automated Tests
Run the test suite:
```bash
npm test
```
