# Dynamic Island for Fedora GNOME

A native Apple-style Dynamic Island for GNOME Shell. It is a **standalone top-center overlay** — not the date menu and not a panel media widget — that morphs for the current activity: notifications, media, volume, brightness, charging, Bluetooth, and privacy.

This is a **GNOME Shell extension**, not an Electron overlay and not a Hyprland layer-shell widget. Mutter has no `wlr-layer-shell`, so the only way the island can sit in the panel on Fedora Wayland is inside the Shell itself.

**Target:** Fedora 44 (GNOME 50), also GNOME 49 and 51 (Fedora 43 / 45).

## Install on Fedora

```bash
sudo dnf install gnome-extensions-app glib2 make zip
git clone https://github.com/XaMiNeZH/dynamic-island-linux.git
cd dynamic-island-linux
./install.sh
```

Settings (alignment, clock, timeouts) apply as soon as you change them. **You do not need to log out for that.**

Wayland cannot reload extension *code* inside the running Shell. Do not log out for every tweak. Open a nested GNOME window instead — your current session and apps stay open:

```bash
sudo dnf install mutter-devkit   # once, GNOME 49+
./tools/try.sh
```

If the island is missing inside that window, enable it there:

```bash
gnome-extensions enable dynamic-island@xaminezh.xyz
```

Log out of the real session only when you want the new code on the host desktop.

Uninstall:

```bash
./uninstall.sh
```

Disable restores notification banners, the stock OSD, and any panel media-controls widget the island hid. The GNOME date and time are never taken over.

## What it does

| State | What you see |
| --- | --- |
| Idle | Small empty black notch; tap for a bounce, right-click for calendar |
| Notification | Pill springs into a card; click opens the app |
| Media (compact) | Album art (or the player icon) and sound waves |
| Media (hover) | Same compact pill, small symbolic play/pause that actually toggles |
| Media (expanded) | Click opens a three-row iPhone card: art/title/waves, leftover seek, centered transport, volume icon on the right |
| Volume / brightness / mute | Island takes over the GNOME OSD |
| Charging | Percentage when you plug in |
| Bluetooth | Device name on connect |
| Recording / mic | Persistent compact activity while in use |

The panel date/time stays where GNOME put it. Right-click the idle notch to open the calendar. Other MPRIS panel widgets (such as media-controls) are hidden by default so they do not sit behind the island.

A later release can add a hybrid dashboard. v1 is Apple-faithful only: live activities and transients, no weather/notes hub.

## Preferences

Open **Extensions → Dynamic Island → Settings** (or `gnome-extensions prefs dynamic-island@xaminezh.xyz`):

- Banner and OSD takeover
- Hide panel media-controls (date menu stays)
- Per-source toggles
- Morph duration and hold times
- Clock format (unused on the idle notch; kept for later)
- Alignment: bar inset and a vertical nudge (live, no logout)

## Development

```bash
make check    # schemas + headless gjs tests
make zip      # pack dynamic-island@xaminezh.xyz.shell-extension.zip
./tools/try.sh  # nested GNOME window; no logout
```

GJS caches extension modules for the life of the `gnome-shell` process. `disable` / `enable` re-runs `enable()` but does **not** pick up file edits. A nested window (`./tools/try.sh`) is a new process, so it loads the files you just installed.

After `./tools/try.sh`, confirm: the panel date/time is still there, media-controls is not peeking through the notch, compact media is art + waves, hover pause is small and toggles playback, and clicking the empty pill expands a **rounded** now-playing card with times above the seek bar, centered transport, and a speaker on the right (no bottom volume slider).

Typography uses **SF Pro** if you have it installed, otherwise the bundled **Inter** font (SIL OFL). Optional system package: `sudo dnf install google-inter-fonts`.

The Cloud Agent environment cannot run Mutter. Visual checks happen on a Fedora GNOME session. Headless tests cover the activity stack, motion math, geometry fit, panel-media matching, and clock/OSD classification.

## Why not the other islands

Projects built for Hyprland/Quickshell look like a Dynamic Island but do not attach to GNOME. Electron/GTK windows cannot live in the GNOME panel on Wayland. Dashboard-style GNOME notches (weather, notes, file shelves) are a different product. This extension stays in-process, uses `St`/`Clutter`, and talks to `MessageTray`, MPRIS, UPower, BlueZ, and `osdWindowManager` directly.

## License

GPL-3.0-or-later. GNOME Shell extensions that import `resource:///org/gnome/shell/` must be GPL-compatible.
