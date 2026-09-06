// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * GNOME's global Do Not Disturb switch stores whether notification banners
 * are shown. Locked and greeter sessions must never receive normal-session
 * island chrome.
 */
export function isFocusActive(showBanners, sessionIsUsable = true) {
    return sessionIsUsable && showBanners === false;
}
