// SPDX-License-Identifier: GPL-3.0-or-later

import {SourceTracker} from '../utils.js';
import {setFftLevels, sixBandsFromSpectrum, unpackSpectrumMagnitudes} from '../fft.js';

export class FftSource {
    constructor() {
        this._tracker = new SourceTracker();
        this._destroyed = false;
        this._pipeline = null;
        this._bus = null;
        this._control = null;
        this._Gst = null;

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
                    this._tracker.connect(this._control, 'state-changed', () => this._restart());
                    this._tracker.connect(this._control, 'default-sink-changed', () => this._restart());
                    this._control.open();
                    this._restart();
                    return;
                } catch {
                    this._control = null;
                }
            }
            this._start(this._pipelines(null));
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

    _pipelines(sinkName) {
        const monitor = sinkName ? `${sinkName}.monitor` : null;
        const launches = [];
        if (monitor) {
            launches.push(
                `pulsesrc device="${monitor}" ! audioconvert ! audio/x-raw,channels=1 ` +
                '! spectrum bands=24 interval=50000000 threshold=-80 post-messages=true ! fakesink');
        }
        launches.push(
            'pipewiresrc always-process=true ! audioconvert ! audio/x-raw,channels=1 ' +
            '! spectrum bands=24 interval=50000000 threshold=-80 post-messages=true ! fakesink');
        return launches;
    }

    _restart() {
        this._stopPipeline();
        this._start(this._pipelines(this._sinkName()));
    }

    _start(launches) {
        if (this._destroyed || !this._Gst)
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
        if (this._destroyed)
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
    }
}
