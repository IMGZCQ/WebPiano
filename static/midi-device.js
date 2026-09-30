const MIDI_NOTE_OFF = 0x80;
const MIDI_NOTE_ON = 0x90;
const MIDI_CC = 0xb0;
const MIDI_PROGRAM_CHANGE = 0xc0;

const CC_SUSTAIN = 64; 
const CC_SOSTENUTO = 66; 
const CC_SOFT = 67; 

const CC_ALL_SOUND_OFF = 120;
const CC_ALL_NOTES_OFF = 123;
const ECHO_GUARD_MS = 200;

export const midiDevice = {
    supported: typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function",

    access: null, 
    inputs: [], 
    outputs: [], 
    inputId: "all", 
    outputId: "",
    channel: 0, 
    velocity: 100,
    inEnabled: true,
    outEnabled: false, 
    onNoteOn: null, 
    onNoteOff: null,
    onSustain: null,
    onSostenuto: null,
    onSoft: null,
    onAllNotesOff: null,
    onProgramChange: null,
    onControlChange: null,
    onPortsChange: null,

    _echo: new Map(), 
    _boundInputs: new Set(),

    async connect() {
        if (!this.supported) {
            throw new Error("当前浏览器不支持 Web MIDI");
        }
        if (!this.access) {
            this.access = await navigator.requestMIDIAccess({ sysex: false });
            this.access.onstatechange = () => this.refreshPorts();
        }
        this.refreshPorts();
        return this.access;
    },

    get output() {
        if (!this.access || !this.outputId) return null;
        return this.access.outputs.get(this.outputId) || null;
    },

    refreshPorts() {
        if (!this.access) return;
        const inputs = [];
        const outputs = [];
        this.access.inputs.forEach((port) => inputs.push(port));
        this.access.outputs.forEach((port) => outputs.push(port));
        this.inputs = inputs;
        this.outputs = outputs;

        inputs.forEach((port) => {
            if (this._boundInputs.has(port.id)) return;
            port.onmidimessage = (event) => this._onMessage(port, event);
            this._boundInputs.add(port.id);
        });

        if (this.inputId !== "all" && !this.access.inputs.get(this.inputId)) {
            this.inputId = "all";
        }
        if (this.outputId && !this.access.outputs.get(this.outputId)) {
            this.outputId = "";
        }

        if (this.onPortsChange) this.onPortsChange();
    },

    _onMessage(port, event) {
        if (this.inputId !== "all" && port.id !== this.inputId) return;
        if (!this.inEnabled) return;

        const data = event.data;
        if (!data || data.length === 0) return;

        const status = data[0];
        if (status >= 0xf0) return;
        if (status < 0x80) return;

        const type = status & 0xf0;
        const channel = status & 0x0f;
        const d1 = data[1] ?? 0;
        const d2 = data[2] ?? 0;

        if (type === MIDI_NOTE_ON && d2 > 0) {
            if (this._consumeEcho(d1)) return;
            if (this.onNoteOn) this.onNoteOn(d1, d2, channel);
        } else if (type === MIDI_NOTE_OFF || (type === MIDI_NOTE_ON && d2 === 0)) {
            if (this._consumeEcho(d1)) return;
            if (this.onNoteOff) this.onNoteOff(d1, channel);
        } else if (type === MIDI_CC) {
            if (d1 === CC_SUSTAIN) {
                if (this.onSustain) this.onSustain(d2 >= 64);
            } else if (d1 === CC_SOSTENUTO) {
                if (this.onSostenuto) this.onSostenuto(d2 >= 64);
            } else if (d1 === CC_SOFT) {
                if (this.onSoft) this.onSoft(d2 >= 64);
            } else if (d1 === CC_ALL_NOTES_OFF || d1 === CC_ALL_SOUND_OFF) {
                if (this.onAllNotesOff) this.onAllNotesOff();
            }
            if (this.onControlChange) this.onControlChange(d1, d2, channel);
        } else if (type === MIDI_PROGRAM_CHANGE) {
            if (this.onProgramChange) this.onProgramChange(d1, channel);
        }
    },

    _markEcho(midi) {
        this._echo.set(midi, performance.now());
        if (this._echo.size > 256) {
            const now = performance.now();
            for (const [note, at] of this._echo) {
                if (now - at > ECHO_GUARD_MS) this._echo.delete(note);
            }
        }
    },

    _consumeEcho(midi) {
        const at = this._echo.get(midi);
        if (at == null) return false;
        this._echo.delete(midi);
        return performance.now() - at < ECHO_GUARD_MS;
    },

    _sendRaw(bytes, timestamp) {
        const out = this.output;
        if (!out) return;
        try {
            if (timestamp != null) out.send(bytes, timestamp);
            else out.send(bytes);
        } catch (_) {
            // A disconnected port throws; dropping the message is fine.
        }
    },

    _send(bytes, timestamp) {
        if (!this.outEnabled) return;
        this._sendRaw(bytes, timestamp);
    },

    sendNoteOn(midi, velocity, channel, timestamp) {
        this._markEcho(midi);
        const ch = (channel == null ? this.channel : channel) & 0x0f;
        let vel = Math.round(velocity == null ? this.velocity : velocity);
        if (!isFinite(vel)) vel = this.velocity;
        vel = Math.max(1, Math.min(127, vel));
        this._send([MIDI_NOTE_ON | ch, midi & 0x7f, vel], timestamp);
    },

    sendNoteOff(midi, channel, timestamp) {
        this._markEcho(midi);
        const ch = (channel == null ? this.channel : channel) & 0x0f;
        this._send([MIDI_NOTE_OFF | ch, midi & 0x7f, 0x40], timestamp);
    },

    sendControlChange(cc, value, channel, timestamp) {
        const ch = (channel == null ? this.channel : channel) & 0x0f;
        const v = Math.max(0, Math.min(127, Math.round(value)));
        this._send([MIDI_CC | ch, cc & 0x7f, v], timestamp);
    },

    sendSustain(on, channel) {
        this.sendControlChange(CC_SUSTAIN, on ? 127 : 0, channel);
    },

    sendSostenuto(on, channel) {
        this.sendControlChange(CC_SOSTENUTO, on ? 127 : 0, channel);
    },

    sendSoft(on, channel) {
        this.sendControlChange(CC_SOFT, on ? 127 : 0, channel);
    },

    panic() {
        const ch = this.channel & 0x0f;
        this._sendRaw([MIDI_CC | ch, CC_ALL_NOTES_OFF, 0]);
        this._sendRaw([MIDI_CC | ch, CC_ALL_SOUND_OFF, 0]);
        this._sendRaw([MIDI_CC | ch, CC_SUSTAIN, 0]);
        this._sendRaw([MIDI_CC | ch, CC_SOSTENUTO, 0]);
        this._sendRaw([MIDI_CC | ch, CC_SOFT, 0]);
        this._echo.clear();
    },
};

export function audioTimeToMidiTimestamp(audioTime, ctx) {
    if (!ctx) return undefined;
    return performance.now() + (audioTime - ctx.currentTime) * 1000;
}
