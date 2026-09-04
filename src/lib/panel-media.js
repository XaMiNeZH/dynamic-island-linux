// SPDX-License-Identifier: GPL-3.0-or-later

const MEDIA_HINT = /mediacontrols|media[-_ ]?controls|media[-_ ]?control\b/i;

export function isPanelMediaRole(role = '', styleClass = '', ctorName = '') {
    return MEDIA_HINT.test(`${role} ${styleClass} ${ctorName}`);
}

export function hidePanelMediaControls(Main) {
    const hidden = [];
    const area = Main?.panel?.statusArea;
    if (!area)
        return hidden;

    for (const [role, actor] of Object.entries(area)) {
        if (!actor)
            continue;
        const styleClass = actor.style_class ?? actor.get_style_class_name?.() ?? '';
        const ctorName = actor.constructor?.name ?? '';
        if (!isPanelMediaRole(role, styleClass, ctorName))
            continue;

        const target = actor.container ?? actor;
        if (target.visible === false)
            continue;
        try {
            target.hide();
            hidden.push(target);
        } catch {
            // actor already gone
        }
    }
    return hidden;
}

export function restorePanelMediaControls(hidden) {
    for (const actor of hidden ?? []) {
        try {
            actor.show();
        } catch {
            // actor already gone
        }
    }
}
