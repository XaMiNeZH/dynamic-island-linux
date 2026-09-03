#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail

UUID="dynamic-island@xaminezh.xyz"
DEST="${HOME}/.local/share/gnome-shell/extensions/${UUID}"
SCHEMA_DIR="${HOME}/.local/share/glib-2.0/schemas"

if command -v gnome-extensions >/dev/null; then
    gnome-extensions disable "${UUID}" 2>/dev/null || true
fi

rm -rf "${DEST}"

# Compiled user schemas are not used by this install path; extension schemas
# live next to the extension. Nothing else to remove.
unset SCHEMA_DIR

echo "Removed ${UUID}."
echo "Log out of Wayland and back in if the GNOME clock does not return immediately."
echo "Disable also restores notification banners and the stock OSD."
