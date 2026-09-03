// SPDX-License-Identifier: GPL-3.0-or-later

export const UUID = 'dynamic-island@xaminezh.xyz';
export const ROLE = 'dynamic-island';
export const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.dynamic-island';

export const Geometry = {
    idle: {width: 126, height: 34, radius: 17},
    compact: {width: 198, height: 34, radius: 17},
    osd: {width: 252, height: 34, radius: 17},
    system: {width: 248, height: 44, radius: 22},
    notification: {width: 348, height: 80, radius: 26},
    mediaExpanded: {width: 332, height: 118, radius: 30},
};

export function geometryFor(kind, expanded = false) {
    switch (kind) {
    case 'notification':
        return Geometry.notification;
    case 'media':
        return expanded ? Geometry.mediaExpanded : Geometry.compact;
    case 'volume':
    case 'brightness':
    case 'mute':
        return Geometry.osd;
    case 'charging':
    case 'bluetooth':
        return Geometry.system;
    case 'privacy':
    case 'recording':
        return expanded ? Geometry.system : Geometry.compact;
    case 'idle':
    default:
        return Geometry.idle;
    }
}

export function isExpandedGeometry(geom) {
    return (geom?.height ?? 0) > 40;
}
