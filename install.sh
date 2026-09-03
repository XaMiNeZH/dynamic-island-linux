#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail

UUID="dynamic-island@xaminezh.xyz"
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

if ! command -v glib-compile-schemas >/dev/null; then
    echo "glib-compile-schemas is required. On Fedora: sudo dnf install glib2" >&2
    exit 1
fi

glib-compile-schemas "${ROOT}/src/schemas"

mkdir -p "${DEST}"
if command -v rsync >/dev/null; then
    rsync -a --delete --exclude '.git' "${ROOT}/src/" "${DEST}/"
else
    rm -rf "${DEST}"
    mkdir -p "${DEST}"
    cp -a "${ROOT}/src/." "${DEST}/"
fi

glib-compile-schemas "${DEST}/schemas"

echo "Installed to ${DEST}"
echo

if command -v gnome-extensions >/dev/null; then
    gnome-extensions enable "${UUID}" 2>/dev/null || true
    echo "If the island is not visible yet, log out of this Wayland session and log back in, then run:"
    echo "  gnome-extensions enable ${UUID}"
else
    echo "gnome-extensions CLI not found. Enable the extension from GNOME Extensions after logging out."
fi

echo
echo "Right-click the pill to open the GNOME calendar. Try:"
echo "  notify-send 'Dynamic Island' 'Hello from Fedora'"
echo "  wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+"
