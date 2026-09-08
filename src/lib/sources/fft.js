// SPDX-License-Identifier: GPL-3.0-or-later

import {SourceTracker} from '../utils.js';
import {
    fftShouldRun,
    setFftLevels,
    sixBandsFromSpectrum,
    spectrumPipelines,
    unpackSpectrumMagnitudes,
} from '../fft.js';

export class FftSource {
    constructor({stack} = {}) {
        this._tracker = new SourceTracker();
        this._destroyed = false;
        this._pipeline = null;
        this._bus = null;
        this._control = null;
        this._Gst = null;
        this._stack = stack ?? null;
        this._wanted = false;
        this._unsub = this._stack?.onChange?.(() => this._syncWanted()) ?? null;

        Promise.all([
            import('gi://Gst').catch(() => null),
            import('gi://Gvc').catch(() => null),
        ]).then(([gstMod, gvcMod]) => {
            if (this._destroyed)
                return;
            const Gst = gstMod?.default;
            if (!Gst?.parse_launch) {
                setFftLevels(null);
                return;
            }
            try {
                Gst.init?.(null);
            } catch {
                // Gst was already initialized by the Shell.
            }
            this._Gst = Gst;
            const Gvc = gvcMod?.default;
            if (Gvc?.MixerControl) {
                try {
                    this._control = new Gvc.MixerControl({name: 'dynamic-island-fft'});
                    this._tracker.connect(this._control, 'state-changed', () => {
                        if (this._wanted)
                            this._restart();
                    });
                    this._tracker.connect(this._control, 'default-sink-changed', () => {
                        if (this._wanted)
                            this._restart();
                    });
                    this._control.open();
                } catch {
                    this._control = null;
                }
            }
            this._syncWanted();
        }).catch(() => {
            setFftLevels(null);
        });
    }

    _sinkName() {
        try {
            const sink = this._control?.get_default_sink?.();
            return sink?.get_name?.() || sink?.name || null;
        } catch {
            return null;
        }
    }

    _syncWanted() {
        if (this._destroyed)
            return;
        const wanted = fftShouldRun(this._stack?.get?.('media'));
        const changed = wanted !== this._wanted;
        this._wanted = wanted;
        if (!wanted) {
            this._stopPipeline();
            return;
        }
        if (changed || !this._pipeline)
            this._restart();
    }

    _restart() {
        this._stopPipeline();
        if (!this._wanted)
            return;
        this._start(spectrumPipelines(this._sinkName()));
    }

    _start(launches) {
        if (this._destroyed || !this._Gst || !this._wanted)
            return;
        for (const launch of launches) {
            try {
                const pipeline = this._Gst.parse_launch(launch);
                const bus = pipeline.get_bus();
                bus.add_signal_watch();
                const id = bus.connect('message', (_b, message) => this._onMessage(message));
                pipeline.set_state(this._Gst.State.PLAYING);
                this._pipeline = pipeline;
                this._bus = bus;
                this._busId = id;
                return;
            } catch {
                // Plugin missing or the monitor name is stale; try the next launch line.
            }
        }
        setFftLevels(null);
    }

    _onMessage(message) {
        if (this._destroyed || !this._wanted)
            return;
        try {
            if (message.type !== this._Gst.MessageType.ELEMENT)
                return;
            const structure = message.get_structure?.();
            if (!structure || structure.get_name?.() !== 'spectrum')
                return;
            let raw = null;
            try {
                raw = structure.get_value?.('magnitude');
            } catch {
                raw = null;
            }
            const bands = sixBandsFromSpectrum(unpackSpectrumMagnitudes(raw));
            setFftLevels(bands);
        } catch {
            // A malformed spectrum message should not take down the Shell.
        }
    }

    _stopPipeline() {
        if (this._bus && this._busId) {
            try {
                this._bus.disconnect(this._busId);
            } catch {
                // bus already gone
            }
        }
        this._busId = 0;
        if (this._bus) {
            try {
                this._bus.remove_signal_watch?.();
            } catch {
                // watch already removed
            }
        }
        this._bus = null;
        if (this._pipeline) {
            try {
                this._pipeline.set_state(this._Gst.State.NULL);
            } catch {
                // pipeline already torn down
            }
        }
        this._pipeline = null;
        setFftLevels(null);
    }

    destroy() {
        this._destroyed = true;
        this._wanted = false;
        this._unsub?.();
        this._unsub = null;
        this._stopPipeline();
        this._tracker.destroy();
        if (this._control) {
            try {
                this._control.close?.();
            } catch {
                // mixer already closed
            }
        }
        this._control = null;
        this._Gst = null;
        this._stack = null;
    }
}
