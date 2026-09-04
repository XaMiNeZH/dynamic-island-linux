// SPDX-License-Identifier: GPL-3.0-or-later

const NORMAL_VOLUME = 65536;

export function outputVolumeFraction(rawVolume, maxVolume, muted = false) {
    if (muted)
        return 0;
    const max = Math.max(1, Number(maxVolume) || NORMAL_VOLUME);
    return Math.max(0, Math.min(1, (Number(rawVolume) || 0) / max));
}

export function outputVolumeRaw(fraction, maxVolume) {
    const max = Math.max(1, Number(maxVolume) || NORMAL_VOLUME);
    const level = Math.max(0, Math.min(1, Number(fraction) || 0));
    return Math.round(level * max);
}

/**
 * Prefer GNOME's default output whenever it is available. MPRIS Volume is a
 * per-player setting and must only be a fallback for desktops without Gvc.
 */
export function selectVolumeControl(output, player) {
    if (output?.available) {
        return {
            hasVolume: true,
            volume: output.volume,
            setVolume: level => output.setVolume(level),
        };
    }
    if (player?.hasVolume) {
        return {
            hasVolume: true,
            volume: player.volume,
            setVolume: level => player.setVolume(level),
        };
    }
    return {hasVolume: false, volume: null, setVolume: () => false};
}

export class OutputVolume {
    constructor(onChange) {
        this._onChange = onChange;
        this._control = null;
        this._sink = null;
        this._controlSignals = [];
        this._sinkSignals = [];
        this._gvc = null;
        this.available = false;
        this.volume = null;
        this._destroyed = false;
        this._load();
    }

    async _load() {
        try {
            const mod = await import('gi://Gvc');
            if (this._destroyed)
                return;
            this._gvc = mod.default;
            if (!this._gvc?.MixerControl)
                return;
            this._control = new this._gvc.MixerControl({
                name: 'dynamic-island-output-volume',
            });
            this._connect(this._control, 'state-changed', () => this._sync());
            this._connect(this._control, 'default-sink-changed', () => this._sync());
            this._control.open();
            this._sync();
        } catch {
            // Gvc is not installed on every GNOME build. MPRIS remains a
            // fallback instead of showing a desktop-volume control that lies.
        }
    }

    _connect(object, signal, callback, list = this._controlSignals) {
        try {
            list.push([object, object.connect(signal, callback)]);
        } catch {
            // Signal differs across Gvc versions.
        }
    }

    _disconnect(list) {
        for (const [object, id] of list.splice(0)) {
            try {
                object.disconnect(id);
            } catch {
                // Object may already have been finalized.
            }
        }
    }

    _maxVolume() {
        try {
            return Math.max(1, Number(this._control?.get_vol_max_norm?.()) || NORMAL_VOLUME);
        } catch {
            return NORMAL_VOLUME;
        }
    }

    _streamVolume(stream) {
        try {
            return Number(stream.get_volume?.() ?? stream.volume);
        } catch {
            return NaN;
        }
    }

    _streamMuted(stream) {
        try {
            return !!(stream.get_is_muted?.() ?? stream.is_muted);
        } catch {
            return false;
        }
    }

    _setSink(sink) {
        if (sink === this._sink)
            return;
        this._disconnect(this._sinkSignals);
        this._sink = sink ?? null;
        if (!this._sink)
            return;
        this._connect(this._sink, 'notify::volume', () => this._sync(), this._sinkSignals);
        this._connect(this._sink, 'notify::is-muted', () => this._sync(), this._sinkSignals);
    }

    _sync() {
        if (this._destroyed || !this._control)
            return;
        const ready = this._gvc?.MixerControlState?.READY;
        if (ready != null && this._control.get_state?.() !== ready) {
            this._setSink(null);
            this.available = false;
            this.volume = null;
            this._onChange?.();
            return;
        }
        let sink = null;
        try {
            sink = this._control.get_default_sink?.() ?? null;
        } catch {
            sink = null;
        }
        this._setSink(sink);
        const raw = sink ? this._streamVolume(sink) : NaN;
        this.available = Number.isFinite(raw);
        this.volume = this.available
            ? outputVolumeFraction(raw, this._maxVolume(), this._streamMuted(sink))
            : null;
        this._onChange?.();
    }

    setVolume(level) {
        if (!this.available || !this._sink)
            return false;
        const raw = outputVolumeRaw(level, this._maxVolume());
        try {
            if (raw > 0) {
                if (this._sink.set_is_muted)
                    this._sink.set_is_muted(false);
                else
                    this._sink.is_muted = false;
            }
            if (this._sink.set_volume)
                this._sink.set_volume(raw);
            else
                this._sink.volume = raw;
            this._sink.push_volume?.();
            this.volume = outputVolumeFraction(raw, this._maxVolume());
            this._onChange?.();
            return true;
        } catch {
            return false;
        }
    }

    destroy() {
        this._destroyed = true;
        this._disconnect(this._sinkSignals);
        this._disconnect(this._controlSignals);
        try {
            this._control?.close?.();
        } catch {
            // close() is unavailable on some Gvc versions.
        }
        this._sink = null;
        this._control = null;
        this._onChange = null;
    }
}
