// SPDX-License-Identifier: GPL-3.0-or-later

export const UUID = 'dynamic-island@xaminezh.xyz';
export const ROLE = 'dynamic-island';
export const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.dynamic-island';

export const Geometry = {
    idle: {width: 126, height: 34, radius: 17, compact: true},
    compact: {width: 198, height: 34, radius: 17, compact: true},
    osd: {width: 252, height: 34, radius: 17, compact: true},
    system: {width: 248, height: 44, radius: 22, compact: false},
    notification: {width: 348, height: 80, radius: 26, compact: false},
    mediaExpanded: {width: 332, height: 118, radius: 30, compact: false},
};

/** Compact pills sit inside the panel with this inset on top and bottom. */
export const COMPACT_PANEL_MARGIN = 1;

export function compactHeightForPanel(panelHeight) {
    const height = Math.max(24, Math.round(panelHeight || 32));
    const margin = height >= 40 ? 3 : COMPACT_PANEL_MARGIN;
    return Math.max(22, height - margin * 2);
}

export function compactTopInset(panelHeight, compactHeight) {
    const height = Math.max(0, Math.round(panelHeight || 0));
    const pill = Math.max(0, Math.round(compactHeight || 0));
    return Math.max(0, Math.round((height - pill) / 2));
}

export function fitGeometryToPanel(geom, panelHeight) {
    if (!geom)
        return geom;
    if (geom.compact === false)
        return {...geom};
    const height = compactHeightForPanel(panelHeight);
    return {
        ...geom,
        height,
        radius: Math.round(height / 2),
        compact: true,
    };
}

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
    return geom?.compact === false;
}
