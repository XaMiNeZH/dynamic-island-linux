#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Run an isolated, software-rendered GNOME Shell smoke test in a Cloud Agent.
# This uses Xvfb -> Weston (Pixman) -> nested GNOME Shell, so no host Wayland,
# KMS device, GPU, or user session is needed.
set -euo pipefail

UUID="dynamic-island@xaminezh.xyz"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-${TMPDIR:-/tmp}/dynamic-island-cloud-try}"
WAIT_SECONDS="${DYNAMIC_ISLAND_SMOKE_WAIT:-12}"

require() {
    command -v "$1" >/dev/null || {
        echo "Missing $1. Use the Cloud Agent GNOME test environment." >&2
        exit 1
    }
}

for command in Xvfb dbus-run-session gnome-extensions gnome-screenshot gnome-shell \
    glib-compile-schemas python3 weston xdpyinfo; do
    require "$command"
done

rm -rf "${OUT}"
mkdir -p "${OUT}/runtime" "${OUT}/data/gnome-shell/extensions" "${OUT}/config"
chmod 700 "${OUT}/runtime"

extension_dir="${OUT}/data/gnome-shell/extensions/${UUID}"
cp -a "${ROOT}/src" "${extension_dir}"
glib-compile-schemas "${extension_dir}/schemas"

# Ubuntu 24.04 supplies GNOME 46 while this project targets 49–51.  The
# isolated copy gets the local shell version only so that the Shell can load
# it and exercise its St/Clutter UI; the repository metadata remains intact.
shell_major="$(gnome-shell --version | awk '{print int($3)}')"
python3 - "${extension_dir}/metadata.json" "${shell_major}" <<'PY'
import json
import sys

path, version = sys.argv[1:]
with open(path, encoding="utf-8") as source:
    metadata = json.load(source)
metadata["shell-version"] = sorted(set(metadata["shell-version"]) | {version})
with open(path, "w", encoding="utf-8") as destination:
    json.dump(metadata, destination, indent=2)
    destination.write("\n")
PY

cleanup() {
    if [[ -n "${xvfb_pid:-}" ]]; then
        kill "${xvfb_pid}" 2>/dev/null || true
        wait "${xvfb_pid}" 2>/dev/null || true
    fi
}
trap cleanup EXIT

Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >"${OUT}/xvfb.log" 2>&1 &
xvfb_pid=$!
for _ in $(seq 1 40); do
    xdpyinfo -display :99 >/dev/null 2>&1 && break
    sleep 0.25
done
xdpyinfo -display :99 >/dev/null

cat >"${OUT}/session.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail

cleanup() {
    for pid in "\${shell_pid:-}" "\${weston_pid:-}" "\${logind_pid:-}"; do
        [[ -n "\${pid}" ]] && kill "\${pid}" 2>/dev/null || true
    done
    for pid in "\${shell_pid:-}" "\${weston_pid:-}" "\${logind_pid:-}"; do
        [[ -n "\${pid}" ]] && wait "\${pid}" 2>/dev/null || true
    done
}
trap cleanup EXIT

# GNOME Shell asks logind for power state. Cloud Agent containers do not boot
# systemd, so bind the standard dbusmock logind template to this private bus.
export DBUS_SYSTEM_BUS_ADDRESS="\${DBUS_SESSION_BUS_ADDRESS}"
python3 -m dbusmock --session -t logind >"${OUT}/logind.log" 2>&1 &
logind_pid=\$!

sleep 1
weston --backend=x11 --renderer=pixman --socket=weston-0 --width=1280 --height=800 \
    --no-config --log="${OUT}/weston.log" &
weston_pid=\$!
for _ in \$(seq 1 40); do
    [[ -S "\${XDG_RUNTIME_DIR}/weston-0" ]] && break
    sleep 0.25
done
[[ -S "\${XDG_RUNTIME_DIR}/weston-0" ]]

gsettings set org.gnome.shell enabled-extensions "['${UUID}']"
WAYLAND_DISPLAY=weston-0 gnome-shell --nested >"${OUT}/gnome-shell.log" 2>&1 &
shell_pid=\$!
sleep "${WAIT_SECONDS}"
kill -0 "\${shell_pid}"

gnome-extensions info "${UUID}" >"${OUT}/extension-info.txt"
gnome-screenshot --display=:99 --file="${OUT}/nested-shell.png"
test -s "${OUT}/nested-shell.png"
EOF
chmod +x "${OUT}/session.sh"

DISPLAY=:99 \
XDG_RUNTIME_DIR="${OUT}/runtime" \
XDG_DATA_HOME="${OUT}/data" \
XDG_CONFIG_HOME="${OUT}/config" \
LIBGL_ALWAYS_SOFTWARE=1 \
dbus-run-session -- bash "${OUT}/session.sh"

echo "Nested GNOME Shell visual smoke test passed."
echo "Screenshot: ${OUT}/nested-shell.png"
echo "Diagnostics: ${OUT}/gnome-shell.log and ${OUT}/extension-info.txt"
