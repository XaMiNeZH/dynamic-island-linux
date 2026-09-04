#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Manual checklist helpers for Fedora Workstation (GNOME 49–51).
set -euo pipefail

echo "Dynamic Island — Fedora try-this list"
echo "0. Prefer:   ./tools/try.sh   (nested GNOME window, no logout)"
echo "1. Or host:  ./install.sh     (settings apply live; code needs try.sh or one logout)"
echo "2. Enable:   gnome-extensions enable dynamic-island@xaminezh.xyz"
echo "3. Clock:    the top-center GNOME clock should now be the black pill"
echo "4. Calendar: right-click the pill"
echo "5. Notify:   notify-send 'Island' 'This should morph the pill'"
echo "6. Volume:   use the volume keys — OSD should appear on the island"
echo "7. Media:    play something in Firefox/Spotify/VLC, then click the pill"
echo "8. Charge:   plug in the laptop"
echo "9. Disable:  gnome-extensions disable dynamic-island@xaminezh.xyz"
echo "   The GNOME clock, banners, and OSD must come back."
echo

if command -v notify-send >/dev/null; then
    notify-send "Dynamic Island" "If the extension is enabled, this notification should land on the island."
fi
