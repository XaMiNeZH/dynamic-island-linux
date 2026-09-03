# Dynamic Island for Fedora GNOME

A native Apple-style Dynamic Island for GNOME Shell. It replaces the top-center clock with a living pill that morphs for the current activity — notifications, media, volume, brightness, charging, Bluetooth, and privacy — then springs back.

This is a **GNOME Shell extension**, not an Electron overlay and not a Hyprland layer-shell widget. Mutter has no `wlr-layer-shell`, so the only way the island can sit in the panel on Fedora Wayland is inside the Shell itself.

**Target:** Fedora 44 (GNOME 50), also GNOME 49 and 51 (Fedora 43 / 45).

## Install on Fedora

```bash
sudo dnf install gnome-extensions-app glib2 make zip
git clone https://github.com/XaMiNeZH/dynamic-island-linux.git
cd dynamic-island-linux
./install.sh
```

Wayland cannot reload GNOME Shell in place. **Log out and log back in**, then:

```bash
gnome-extensions enable dynamic-island@xaminezh.xyz
```

Uninstall:

```bash
./uninstall.sh
```

Disable restores the GNOME clock, notification banners, and stock OSD.

## What it does

| State | What you see |
| --- | --- |
| Idle | Top-center notch with the clock; tap for a bounce, right-click for calendar |
| Notification | Pill springs into a card; click opens the app |
| Media | Album art and a live equalizer keep the clock in the middle; click expands transport |
| Volume / brightness / mute | Island takes over the GNOME OSD |
| Charging | Percentage when you plug in |
| Bluetooth | Device name on connect |
| Recording / mic | Persistent compact activity while in use |

Right-click the idle pill to open the GNOME calendar (the date menu is hidden, not deleted).

A later release can add a hybrid dashboard. v1 is Apple-faithful only: live activities and transients, no weather/notes hub.

## Preferences

Open **Extensions → Dynamic Island → Settings** (or `gnome-extensions prefs dynamic-island@xaminezh.xyz`):

- Banner and OSD takeover
- Per-source toggles
- Morph duration and hold times
- Clock format (follow GNOME, 12-hour, 24-hour)

## Development

```bash
make check    # schemas + headless gjs tests
make zip      # pack dynamic-island@xaminezh.xyz.shell-extension.zip
```

The Cloud Agent environment cannot run Mutter. Visual checks happen on a Fedora GNOME session. Headless tests cover the activity stack, motion math, and clock/OSD classification.

## Why not the other islands

Projects built for Hyprland/Quickshell look like a Dynamic Island but do not attach to GNOME. Electron/GTK windows cannot live in the GNOME panel on Wayland. Dashboard-style GNOME notches (weather, notes, file shelves) are a different product. This extension stays in-process, uses `St`/`Clutter`, and talks to `MessageTray`, MPRIS, UPower, BlueZ, and `osdWindowManager` directly.

## License

GPL-3.0-or-later. GNOME Shell extensions that import `resource:///org/gnome/shell/` must be GPL-compatible.
