// Virtual Piano - main app
// Vanilla JS + Web Audio API, no build step.

import { Soundfont } from "./vendor/smplr.mjs";
import { Midi } from "./vendor/tonejs-midi.mjs";
import { midiDevice, audioTimeToMidiTimestamp } from "./midi-device.js";

const SAMPLE_BASE = "samples/piano/";
const WHITE_COUNT = 36;

// SoundFont keyboard note sustain parameters.
// A key press starts the note with NO fixed duration so it sustains until the
// sample buffer ends naturally OR the key is released. On release:
//  - short press (< SHORT_PRESS_THRESHOLD_MS): let it ring for ~SHORT_PRESS_RING_MS
//    total (matching the previous fixed-duration feel), then stop.
//  - long press: stop immediately so smplr's 0.3s release envelope fades it out.
const SHORT_PRESS_THRESHOLD_MS = 250;
const SHORT_PRESS_RING_MS = 600;

// Note layout. Each entry: name, keys (array of supported keys), file, type, whiteIndex.
// `keys` is a list of normalized key identifiers (see normalizeKey below).
// For black keys, the first key in the array is the "primary" key used with
// the black-mode modifier (` or Space) to trigger the sharp note. For white
// keys, the first key is shown prominently and any additional keys (arrow
// keys, numpad keys) act as alternative bindings.
//
// Layout (left → right, low → high):
//   1-8   → C2..C3
//   Q-I   → C3..C4
//   A-K   → C4..C5
//   Z-,   → C5..C6
//   0/-/= → C6/D6/E6
//   P/[/] → F6/G6/A6
//   ;/'   → B6/C7
// C3, C4, C5, C6 are shared between adjacent rows (e.g. C3 is 8 and Q).
// Right-side keys (Arrow* and Numpad*) are kept as secondaries on C4..B6.
const NOTES = [
    // Octave 2 (white idx 0..6) - 1..7 = C2..B2
    { name: "C2", keys: ["1"], file: "a49.mp3", type: "white", whiteIndex: 0 },
    { name: "C#2", keys: ["1"], file: "b49.mp3", type: "black", whiteIndex: 0 },
    { name: "D2", keys: ["2"], file: "a50.mp3", type: "white", whiteIndex: 1 },
    { name: "D#2", keys: ["2"], file: "b50.mp3", type: "black", whiteIndex: 1 },
    { name: "E2", keys: ["3"], file: "a51.mp3", type: "white", whiteIndex: 2 },
    { name: "F2", keys: ["4"], file: "a52.mp3", type: "white", whiteIndex: 3 },
    { name: "F#2", keys: ["4"], file: "b52.mp3", type: "black", whiteIndex: 3 },
    { name: "G2", keys: ["5"], file: "a53.mp3", type: "white", whiteIndex: 4 },
    { name: "G#2", keys: ["5"], file: "b53.mp3", type: "black", whiteIndex: 4 },
    { name: "A2", keys: ["6"], file: "a54.mp3", type: "white", whiteIndex: 5 },
    { name: "A#2", keys: ["6"], file: "b54.mp3", type: "black", whiteIndex: 5 },
    { name: "B2", keys: ["7"], file: "a55.mp3", type: "white", whiteIndex: 6 },

    // Octave 3 (white idx 7..13) - 8 + Q..U = C3..B3
    { name: "C3", keys: ["8", "Q"], file: "a56.mp3", type: "white", whiteIndex: 7 },
    { name: "C#3", keys: ["8", "Q"], file: "b56.mp3", type: "black", whiteIndex: 7 },
    { name: "D3", keys: ["W"], file: "a57.mp3", type: "white", whiteIndex: 8 },
    { name: "D#3", keys: ["W"], file: "b57.mp3", type: "black", whiteIndex: 8 },
    { name: "E3", keys: ["E"], file: "a48.mp3", type: "white", whiteIndex: 9 },
    { name: "F3", keys: ["R"], file: "a81.mp3", type: "white", whiteIndex: 10 },
    { name: "F#3", keys: ["R"], file: "b81.mp3", type: "black", whiteIndex: 10 },
    { name: "G3", keys: ["T"], file: "a87.mp3", type: "white", whiteIndex: 11 },
    { name: "G#3", keys: ["T"], file: "b87.mp3", type: "black", whiteIndex: 11 },
    { name: "A3", keys: ["Y"], file: "a69.mp3", type: "white", whiteIndex: 12 },
    { name: "A#3", keys: ["Y"], file: "b69.mp3", type: "black", whiteIndex: 12 },
    { name: "B3", keys: ["U"], file: "a82.mp3", type: "white", whiteIndex: 13 },

    // Octave 4 (white idx 14..20) - I+A / S / D / F / G / H / J = C4..B4
    // Arrow keys (Left/Down/Right/Up) stay bound to C4..F4.
    { name: "C4", keys: ["I", "A", "ArrowLeft"], file: "a84.mp3", type: "white", whiteIndex: 14 },
    { name: "C#4", keys: ["I", "A", "ArrowLeft"], file: "b84.mp3", type: "black", whiteIndex: 14 },
    { name: "D4", keys: ["S", "ArrowDown"], file: "a89.mp3", type: "white", whiteIndex: 15 },
    { name: "D#4", keys: ["S", "ArrowDown"], file: "b89.mp3", type: "black", whiteIndex: 15 },
    { name: "E4", keys: ["D", "ArrowRight"], file: "a85.mp3", type: "white", whiteIndex: 16 },
    { name: "F4", keys: ["F", "ArrowUp"], file: "a73.mp3", type: "white", whiteIndex: 17 },
    { name: "F#4", keys: ["F", "ArrowUp"], file: "b73.mp3", type: "black", whiteIndex: 17 },
    { name: "G4", keys: ["G", "Numpad0"], file: "a79.mp3", type: "white", whiteIndex: 18 },
    { name: "G#4", keys: ["G", "Numpad0"], file: "b79.mp3", type: "black", whiteIndex: 18 },
    { name: "A4", keys: ["H", "NumpadDecimal"], file: "a80.mp3", type: "white", whiteIndex: 19 },
    { name: "A#4", keys: ["H", "NumpadDecimal"], file: "b80.mp3", type: "black", whiteIndex: 19 },
    { name: "B4", keys: ["J", "NumpadEnter"], file: "a65.mp3", type: "white", whiteIndex: 20 },

    // Octave 5 (white idx 21..27) - K+Z / X / C / V / B / N / M = C5..B5
    { name: "C5", keys: ["K", "Z", "Numpad1"], file: "a83.mp3", type: "white", whiteIndex: 21 },
    { name: "C#5", keys: ["K", "Z", "Numpad1"], file: "b83.mp3", type: "black", whiteIndex: 21 },
    { name: "D5", keys: ["X", "Numpad2"], file: "a68.mp3", type: "white", whiteIndex: 22 },
    { name: "D#5", keys: ["X", "Numpad2"], file: "b68.mp3", type: "black", whiteIndex: 22 },
    { name: "E5", keys: ["C", "Numpad3"], file: "a70.mp3", type: "white", whiteIndex: 23 },
    { name: "F5", keys: ["V", "Numpad4"], file: "a71.mp3", type: "white", whiteIndex: 24 },
    { name: "F#5", keys: ["V", "Numpad4"], file: "b71.mp3", type: "black", whiteIndex: 24 },
    { name: "G5", keys: ["B", "Numpad5"], file: "a72.mp3", type: "white", whiteIndex: 25 },
    { name: "G#5", keys: ["B", "Numpad5"], file: "b72.mp3", type: "black", whiteIndex: 25 },
    { name: "A5", keys: ["N", "Numpad6"], file: "a74.mp3", type: "white", whiteIndex: 26 },
    { name: "A#5", keys: ["N", "Numpad6"], file: "b74.mp3", type: "black", whiteIndex: 26 },
    { name: "B5", keys: ["M", "Numpad7"], file: "a75.mp3", type: "white", whiteIndex: 27 },

    // Octave 6 (white idx 28..34) - 0+, / - / = / P / [ / ] / ; = C6..B6
    { name: "C6", keys: ["0", ",", "Numpad8"], file: "a76.mp3", type: "white", whiteIndex: 28 },
    { name: "C#6", keys: ["0", ",", "Numpad8"], file: "b76.mp3", type: "black", whiteIndex: 28 },
    { name: "D6", keys: ["-", "Numpad9"], file: "a90.mp3", type: "white", whiteIndex: 29 },
    { name: "D#6", keys: ["-", "Numpad9"], file: "b90.mp3", type: "black", whiteIndex: 29 },
    { name: "E6", keys: ["=", "NumpadAdd"], file: "a88.mp3", type: "white", whiteIndex: 30 },
    { name: "F6", keys: ["P", "NumLock"], file: "a67.mp3", type: "white", whiteIndex: 31 },
    { name: "F#6", keys: ["P", "NumLock"], file: "b67.mp3", type: "black", whiteIndex: 31 },
    { name: "G6", keys: ["[", "NumpadDivide"], file: "a86.mp3", type: "white", whiteIndex: 32 },
    { name: "G#6", keys: ["[", "NumpadDivide"], file: "b86.mp3", type: "black", whiteIndex: 32 },
    { name: "A6", keys: ["]", "NumpadMultiply"], file: "a66.mp3", type: "white", whiteIndex: 33 },
    { name: "A#6", keys: ["]", "NumpadMultiply"], file: "b66.mp3", type: "black", whiteIndex: 33 },
    { name: "B6", keys: [";", "NumpadSubtract"], file: "a78.mp3", type: "white", whiteIndex: 34 },

    // Octave 7 (white idx 35) - ' = C7
    { name: "C7", keys: ["'"], file: "a77.mp3", type: "white", whiteIndex: 35 },
];

// Map internal normalized key identifiers to user-friendly display glyphs.
const KEY_DISPLAY = {
    ArrowLeft: "←",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowRight: "→",
    Numpad0: "0",
    Numpad1: "1",
    Numpad2: "2",
    Numpad3: "3",
    Numpad4: "4",
    Numpad5: "5",
    Numpad6: "6",
    Numpad7: "7",
    Numpad8: "8",
    Numpad9: "9",
    NumpadDecimal: ".",
    NumpadEnter: "↵",
    NumpadAdd: "+",
    NumpadDivide: "/",
    NumpadMultiply: "×",
    NumpadSubtract: "−",
    NumLock: "Num",
};

function displayKey(k) {
    return KEY_DISPLAY[k] || k;
}

// Normalize a KeyboardEvent to a stable internal key identifier we can match
// against `NOTES[].keys`. Top-row digits ("0".."9") and numpad digits share
// e.key, and when NumLock is off the numpad arrow keys (Numpad2/4/6/8) report
// e.key = "ArrowDown/Left/Right/Up" too. We therefore trust e.code first for
// any Numpad* physical key, then fall back to e.key for top-row letters,
// digits, and the real (non-numpad) arrow keys.
function normalizeKey(e) {
    if (!e) return null;
    if (/^[a-zA-Z]$/.test(e.key)) return e.key.toUpperCase();
    if (e.code && e.code.startsWith("Numpad")) return e.code;
    if (/^[0-9]$/.test(e.key)) return e.key;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
        e.key === "ArrowUp" || e.key === "ArrowDown") return e.key;
    if (e.code === "NumLock") return "NumLock";
    // Symbol keys (,-=[];' ) — use e.code because e.key changes with shift
    // (e.g. Shift+= produces e.key "+" on US layouts).
    switch (e.code) {
        case "Comma": return ",";
        case "Minus": return "-";
        case "Equal": return "=";
        case "BracketLeft": return "[";
        case "BracketRight": return "]";
        case "Semicolon": return ";";
        case "Quote": return "'";
    }
    return null;
}

// ---------- Keyboard binding diagram ----------
// Physical key id (e.code without the "Digit/Key" prefix where possible) and
// the visible label printed on the key cap. `w` is the width in keyboard
// "units" (1u = a standard alpha key). Width classes (w15, w175, w2, w225,
// w275, w125, w625) are defined in style.css.
const KB_MAIN_LAYOUT = [
    // Row 1: ` 1 2 3 4 5 6 7 8 9 0 - = Backspace
    [
        { id: "Backquote", label: "`", w: 1, subLabel: "黑键" },
        { id: "Digit1", label: "1", w: 1 },
        { id: "Digit2", label: "2", w: 1 },
        { id: "Digit3", label: "3", w: 1 },
        { id: "Digit4", label: "4", w: 1 },
        { id: "Digit5", label: "5", w: 1 },
        { id: "Digit6", label: "6", w: 1 },
        { id: "Digit7", label: "7", w: 1 },
        { id: "Digit8", label: "8", w: 1 },
        { id: "Digit9", label: "9", w: 1 },
        { id: "Digit0", label: "0", w: 1 },
        { id: "Minus", label: "-", w: 1 },
        { id: "Equal", label: "=", w: 1 },
        { id: "Backspace", label: "退格键", w: 2.85 },
        { id: "NumLock", label: "Num", w: 1 },
        { id: "NumpadDivide", label: "/", w: 1 },
        { id: "NumpadMultiply", label: "*", w: 1 },
        { id: "NumpadSubtract", label: "-", w: 1 },
    ],
    // Row 2: Tab Q W E R T Y U I O P [ ] \
    [
        { id: "Tab", label: "Tab", w: 1.5 },
        { id: "KeyQ", label: "Q", w: 1 },
        { id: "KeyW", label: "W", w: 1 },
        { id: "KeyE", label: "E", w: 1 },
        { id: "KeyR", label: "R", w: 1 },
        { id: "KeyT", label: "T", w: 1 },
        { id: "KeyY", label: "Y", w: 1 },
        { id: "KeyU", label: "U", w: 1 },
        { id: "KeyI", label: "I", w: 1 },
        { id: "KeyO", label: "O", w: 1 },
        { id: "KeyP", label: "P", w: 1 },
        { id: "BracketLeft", label: "[", w: 1 },
        { id: "BracketRight", label: "]", w: 1 },
        { id: "Backslash", label: "\\", w: 2.35 },
        { id: "Numpad7", label: "7", w: 1 },
        { id: "Numpad8", label: "8", w: 1 },
        { id: "Numpad9", label: "9", w: 1 },
        { id: "NumpadAdd", label: "+", w: 1, rowSpan: 2 },
    ],
    // Row 3: Caps A S D F G H J K L ; ' Enter
    [
        { id: "CapsLock", label: "Caps", w: 1.75 },
        { id: "KeyA", label: "A", w: 1 },
        { id: "KeyS", label: "S", w: 1 },
        { id: "KeyD", label: "D", w: 1 },
        { id: "KeyF", label: "F", w: 1 },
        { id: "KeyG", label: "G", w: 1 },
        { id: "KeyH", label: "H", w: 1 },
        { id: "KeyJ", label: "J", w: 1 },
        { id: "KeyK", label: "K", w: 1 },
        { id: "KeyL", label: "L", w: 1 },
        { id: "Semicolon", label: ";", w: 1 },
        { id: "Quote", label: "'", w: 1 },
        { id: "Enter", label: "Enter", w: 2.1, rowSpan: 1 },
        { id: "", label: "", w: 1 },
        { id: "Numpad4", label: "4", w: 1 },
        { id: "Numpad5", label: "5", w: 1 },
        { id: "Numpad6", label: "6", w: 1 },
    ],
    // Row 4: Shift Z X C V B N M , . / Shift
    [
        { id: "ShiftLeft", label: "Shift", w: 2.25 },
        { id: "KeyZ", label: "Z", w: 1 },
        { id: "KeyX", label: "X", w: 1 },
        { id: "KeyC", label: "C", w: 1 },
        { id: "KeyV", label: "V", w: 1 },
        { id: "KeyB", label: "B", w: 1 },
        { id: "KeyN", label: "N", w: 1 },
        { id: "KeyM", label: "M", w: 1 },
        { id: "Comma", label: ",", w: 1 },
        { id: "Period", label: ".", w: 1, pedal: "soft" },
        { id: "Slash", label: "/", w: 1, pedal: "sostenuto" },
        { id: "ShiftRight", label: "Shift", w: 1.65 },
        { id: "ArrowUp", label: "↑", w: 1 },
        { id: "", label: "", w: 0.95 },
        { id: "Numpad1", label: "1", w: 1 },
        { id: "Numpad2", label: "2", w: 1 },
        { id: "Numpad3", label: "3", w: 1 },
        { id: "NumpadEnter", label: "↵", w: 1, rowSpan: 2 },
    ],
    // Row 5: Ctrl Win Alt Space Alt Win Menu Ctrl
    [
        { id: "ControlLeft", label: "Ctrl", w: 1 },
        { id: "MetaLeft", label: "Win", w: 1 },
        { id: "AltLeft", label: "Alt", w: 1 },
        { id: "Space", label: "", w: 6.25, subLabel: "空格 黑键辅助" },
        { id: "AltRight", label: "Alt", w: 1, pedal: "sustain" },
        { id: "MetaRight", label: "Win", w: 1 },
        { id: "ContextMenu", label: "Menu", w: 1 },
        { id: "ControlRight", label: "Ctrl", w: 1 },
        { id: "ArrowLeft", label: "←", w: 1 },
        { id: "ArrowDown", label: "↓", w: 1 },
        { id: "ArrowRight", label: "→", w: 1 },
        { id: "Numpad0", label: "0", w: 1.75 },
        { id: "NumpadDecimal", label: ".", w: 1.25 },
    ],
];

// Map physical key id → normalized key identifier we use in NOTES[].keys.
const KB_ID_TO_NORM = {
    Digit1: "1", Digit2: "2", Digit3: "3", Digit4: "4", Digit5: "5",
    Digit6: "6", Digit7: "7", Digit8: "8", Digit9: "9", Digit0: "0",
    KeyQ: "Q", KeyW: "W", KeyE: "E", KeyR: "R", KeyT: "T", KeyY: "Y",
    KeyU: "U", KeyI: "I", KeyO: "O", KeyP: "P",
    KeyA: "A", KeyS: "S", KeyD: "D", KeyF: "F", KeyG: "G", KeyH: "H",
    KeyJ: "J", KeyK: "K", KeyL: "L",
    KeyZ: "Z", KeyX: "X", KeyC: "C", KeyV: "V", KeyB: "B", KeyN: "N", KeyM: "M",
    Comma: ",", Period: ".", Slash: "/",
    Minus: "-", Equal: "=",
    BracketLeft: "[", BracketRight: "]", Backslash: "\\",
    Semicolon: ";", Quote: "'",
    ArrowUp: "ArrowUp", ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight",
    NumLock: "NumLock",
    Numpad0: "Numpad0", Numpad1: "Numpad1", Numpad2: "Numpad2",
    Numpad3: "Numpad3", Numpad4: "Numpad4", Numpad5: "Numpad5",
    Numpad6: "Numpad6", Numpad7: "Numpad7", Numpad8: "Numpad8",
    Numpad9: "Numpad9",
    NumpadAdd: "NumpadAdd", NumpadSubtract: "NumpadSubtract",
    NumpadMultiply: "NumpadMultiply", NumpadDivide: "NumpadDivide",
    NumpadDecimal: "NumpadDecimal", NumpadEnter: "NumpadEnter",
};

// Reverse map: note name → list of physical key ids in the keyboard
// diagram that should highlight when the note is triggered. Populated
// by renderKeyboardDiagram() once the diagram is built.
let noteToKbIds = new Map();

function buildKeyToNotes() {
    const map = new Map();
    NOTES.forEach((note) => {
        note.keys.forEach((k) => {
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(note);
        });
    });
    return map;
}

// Reverse map: note name → list of physical key ids in the keyboard
// diagram that should highlight when the note is triggered.
function buildNoteToKbIds() {
    const map = new Map();
    // Build a reverse lookup of normalized key → list of physical ids.
    const normToIds = new Map();
    for (const [kbId, norm] of Object.entries(KB_ID_TO_NORM)) {
        if (!normToIds.has(norm)) normToIds.set(norm, []);
        normToIds.get(norm).push(kbId);
    }
    NOTES.forEach((note) => {
        const ids = [];
        note.keys.forEach((key) => {
            const kbIds = normToIds.get(key);
            if (kbIds) kbIds.forEach((id) => ids.push(id));
        });
        if (ids.length > 0) map.set(note.name, ids);
    });
    return map;
}

function makeKbKeyEl(keyDef, keyToNotes) {
    const el = document.createElement("div");
    el.className = "kb-key";
    el.dataset.kbId = keyDef.id;
    const wKey = "w" + String(keyDef.w).replace(".", "");
    el.classList.add(wKey);
    if (keyDef.rowSpan && keyDef.rowSpan > 1) {
        el.classList.add("row-span-" + keyDef.rowSpan);
    }

    const label = document.createElement("span");
    label.className = "kb-key-label";
    label.textContent = keyDef.label;
    el.appendChild(label);

    if (keyDef.subLabel) {
        el.classList.add("is-modifier");
        const sub = document.createElement("span");
        sub.className = "kb-key-sublabel";
        sub.textContent = keyDef.subLabel;
        el.appendChild(sub);
    }

    const norm = KB_ID_TO_NORM[keyDef.id];
    const notes = norm ? keyToNotes.get(norm) || [] : [];
    if (notes.length > 0) {
        el.classList.add("has-note");
        const wrap = document.createElement("span");
        wrap.className = "kb-key-notes";
        // Show white note first, then black note (with ` prefix indicating
        // that the black key is triggered by holding ` or Space).
        notes.forEach((n) => {
            const nspan = document.createElement("span");
            nspan.className = n.type === "black" ? "kb-note-black" : "kb-note-white";
            nspan.textContent = (n.type === "black" ? "`" : "") + n.name;
            wrap.appendChild(nspan);
        });
        el.appendChild(wrap);

        // Clicking a diagram key triggers the bound note (white by default,
        // black note when the black-mode enable key — ` or Space — is held).
        el.addEventListener("mousedown", (ev) => {
            ev.preventDefault();
            let note = null;
            if (isBlackModeActive()) note = notes.find((n) => n.type === "black");
            if (!note) note = notes.find((n) => n.type === "white") || notes[0];
            if (note) {
                pressMouseNote(note.name);
                if (lastPointerTrigger !== note.name) {
                    lastPointerTrigger = note.name;
                    playNote(note);
                }
                activateByName(note.name);
            }
        });
    }

    if (keyDef.pedal) {
        const pedal = PEDALS[keyDef.pedal];
        el.classList.add("has-note", "is-pedal");
        el.title = `${pedal.label}踏板 CC${pedal.cc} · 按住发往 MIDI 设备`;
        const wrap = document.createElement("span");
        wrap.className = "kb-key-notes";
        const span = document.createElement("span");
        span.className = "kb-note-pedal";
        span.textContent = `CC${pedal.cc}`;
        wrap.appendChild(span);
        el.appendChild(wrap);

        el.addEventListener("mousedown", (ev) => {
            ev.preventDefault();
            pedal.pointer = true;
            setPedalLocal(keyDef.pedal, true);
        });
    }
    return el;
}

function renderKeyboardDiagram() {
    const container = document.getElementById("keyboard-diagram");
    if (!container) return;
    container.innerHTML = "";
    const keyToNotes = buildKeyToNotes();
    // Cache the reverse map so activateByName can highlight diagram keys.
    noteToKbIds = buildNoteToKbIds();

    // Main alpha block: 5 stacked rows.
    const main = document.createElement("div");
    main.className = "kb-section kb-main";
    KB_MAIN_LAYOUT.forEach((row) => {
        const rowEl = document.createElement("div");
        rowEl.className = "kb-row";
        row.forEach((k) => rowEl.appendChild(makeKbKeyEl(k, keyToNotes)));
        main.appendChild(rowEl);
    });
    container.appendChild(main);
}

// ---------- Web Audio ----------
const audio = {
    ctx: null,
    master: null,
    soft: null, // gain node the soft pedal (CC67) ducks
    buffers: new Map(), // file -> AudioBuffer
    loadProgress: 0,
    loadTotal: 0,
};

const SOFT_PEDAL_GAIN = 0.55;

async function initAudio() {
    if (audio.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 1.0;
    audio.soft = audio.ctx.createGain();
    audio.soft.gain.value = 1.0;
    audio.master.connect(audio.soft);
    audio.soft.connect(audio.ctx.destination);
}

function setSoftPedalGain(on) {
    if (!audio.ctx || !audio.soft) return;
    const target = on ? SOFT_PEDAL_GAIN : 1.0;
    try {
        audio.soft.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.02);
    } catch (_) {
        audio.soft.gain.value = target;
    }
}

async function loadAllSamples(onProgress) {
    await initAudio();
    const files = Array.from(new Set(NOTES.map((n) => n.file)));
    audio.loadTotal = files.length;
    audio.loadProgress = 0;

    await Promise.all(
        files.map(async (file) => {
            const url = SAMPLE_BASE + file;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`Failed to load ${file}: ${resp.status}`);
            const arr = await resp.arrayBuffer();
            const buf = await audio.ctx.decodeAudioData(arr.slice(0));
            audio.buffers.set(file, buf);
            audio.loadProgress += 1;
            if (onProgress) onProgress(audio.loadProgress / audio.loadTotal);
        })
    );
}
function clampVelocity(velocity) {
    if (velocity == null) return 100;
    const v = Math.round(velocity);
    if (!isFinite(v)) return 100;
    return Math.max(1, Math.min(127, v));
}

function playNote(note, velocity) {
    if (!audio.ctx) return;
    const vel = clampVelocity(velocity);
    // Default selection: original per-key MP3 samples. Other selections go
    // through the loaded Soundfont so the user hears the chosen timbre.
    if (keyboard.currentInstrument === "default") {
        const buf = audio.buffers.get(note.file);
        if (!buf) return;
        const src = audio.ctx.createBufferSource();
        src.buffer = buf;
        const gain = audio.ctx.createGain();
        gain.gain.value = vel / 127;
        src.connect(gain);
        gain.connect(audio.master);
        src.start(0);
        return;
    }
    ensureKeyboardInstrument(keyboard.currentInstrument).then(sf => {
        if (!sf) return;
        // Cancel any previous un-stopped instance of the same pitch so
        // re-triggers don't pile up and so switching off the key releases
        // the note promptly. The Soundfont handles the release envelope.
        const existing = keyboard.activeStops.get(note.name);
        if (existing) {
            try { existing(); } catch (_) {}
        }
        // A pending short-release timer (from a previous short press) is no
        // longer relevant now that the note has been re-triggered.
        const pendingTimer = keyboard.activeShortReleaseTimers.get(note.name);
        if (pendingTimer) {
            clearTimeout(pendingTimer);
            keyboard.activeShortReleaseTimers.delete(note.name);
        }
        try {
            // Start WITHOUT a fixed duration so the note sustains until the
            // sample buffer ends naturally OR releaseKeyboardNote() calls the
            // returned stop fn on key-up. Passing a duration would make smplr
            // pre-schedule the decay envelope (startDecay), which permanently
            // locks stopAt — after that, calling stop() early has no effect.
            // With no duration, stop() on key-up properly triggers the 0.3s
            // release fade-out.
            const stopFn = sf.start({
                note: note.name,
                time: audio.ctx.currentTime,
                velocity: vel,
            });
            if (typeof stopFn === "function") {
                keyboard.activeStops.set(note.name, stopFn);
                keyboard.activeStartTimes.set(note.name, performance.now());
            }
        } catch (_) {
            // Ignore individual note failures (e.g. notes outside the
            // SoundFont's sampled range).
        }
    });
}

// ---------- DOM / render ----------
const pianoEl = document.getElementById("piano");
const keysEl = document.getElementById("keys");
const showKeyEl = document.getElementById("toggle-key");
const showNoteEl = document.getElementById("toggle-note");
const volumeEl = null;
const touchModeEl = document.getElementById("toggle-touch");
const touchPianoEl = document.getElementById("touch-piano");
const touchKeysHighEl = document.getElementById("touch-keys-high");
const touchKeysLowEl = document.getElementById("touch-keys-low");
let touchPianoRendered = false;

function renderPiano() {
    keysEl.innerHTML = "";
    const whiteWidth = 100 / WHITE_COUNT;
    const blackWidth = whiteWidth * 0.62;

    // White keys first
    NOTES.filter((n) => n.type === "white").forEach((n) => {
        const el = document.createElement("div");
        el.className = "key-white";
        el.dataset.name = n.name;
        el.dataset.type = "white";

        const primary = displayKey(n.keys[0]);
        const extras = n.keys
            .slice(1)
            .map((k) => `<span class="key-name-extra">${displayKey(k)}</span>`)
            .join("");

        el.innerHTML =
            `<span class="key-name"><span class="key-name-primary">${primary}</span>${extras}</span>` +
            `<span class="key-note">${n.name}</span>`;
        keysEl.appendChild(el);
    });

    // Black keys positioned absolutely
    NOTES.filter((n) => n.type === "black").forEach((n) => {
        const el = document.createElement("div");
        el.className = "key-black";
        el.dataset.name = n.name;
        el.dataset.type = "black";
        el.style.left = `calc(${(n.whiteIndex + 1) * whiteWidth}% - ${blackWidth / 2}%)`;
        el.style.width = `${blackWidth}%`;
        el.innerHTML = `<span class="key-shift-hint">\`${displayKey(n.keys[0])}</span>`;
        keysEl.appendChild(el);
    });
}

// Render the two touch-mode rows. Each row is a self-contained mini piano
// covering a sub-range of NOTES. Black keys are positioned using a local
// white index so they line up with the row's own white keys.
function renderTouchPiano() {
    renderTouchRow(touchKeysHighEl, "F4", "C7");
    renderTouchRow(touchKeysLowEl, "C2", "E4");
    touchPianoRendered = true;
}

function renderTouchRow(container, startName, endName) {
    container.innerHTML = "";
    const startIdx = NOTES.findIndex((n) => n.name === startName);
    const endIdx = NOTES.findIndex((n) => n.name === endName);
    if (startIdx === -1 || endIdx === -1) return;

    const rowNotes = NOTES.slice(startIdx, endIdx + 1);
    const whiteNotes = rowNotes.filter((n) => n.type === "white");
    const whiteCount = whiteNotes.length;
    if (whiteCount === 0) return;
    const baseWhiteIndex = whiteNotes[0].whiteIndex;
    container.style.setProperty("--white-count", whiteCount);

    const whiteWidth = 100 / whiteCount;
    const blackWidth = whiteWidth * 0.62;

    whiteNotes.forEach((n) => {
        const el = document.createElement("div");
        el.className = "key-white";
        el.dataset.name = n.name;
        el.dataset.type = "white";

        const primary = displayKey(n.keys[0]);
        const extras = n.keys
            .slice(1)
            .map((k) => `<span class="key-name-extra">${displayKey(k)}</span>`)
            .join("");

        el.innerHTML =
            `<span class="key-name"><span class="key-name-primary">${primary}</span>${extras}</span>` +
            `<span class="key-note">${n.name}</span>`;
        container.appendChild(el);
    });

    rowNotes
        .filter((n) => n.type === "black")
        .forEach((n) => {
            const el = document.createElement("div");
            el.className = "key-black";
            el.dataset.name = n.name;
            el.dataset.type = "black";
            const localWhiteIndex = n.whiteIndex - baseWhiteIndex;
            // Express the black-key offset as a CSS custom property so the
            // same value drives `left` in landscape and `top` in portrait.
            // The offset is the boundary between two white keys minus half
            // the black key's own size, so the key is centered on the gap.
            const offsetPct = (localWhiteIndex + 1) * whiteWidth;
            const halfBlackPct = blackWidth / 2;
            el.style.setProperty("--bk-start", `${offsetPct}%`);
            el.style.setProperty("--bk-half", `${halfBlackPct}%`);
            el.style.setProperty("--bk-size", `${blackWidth}%`);
            el.innerHTML = `<span class="key-shift-hint">\`${displayKey(n.keys[0])}</span>`;
            container.appendChild(el);
        });
}

function setKeyVisible() {
    const showKey = showKeyEl.checked;
    const showNote = showNoteEl.checked;
    document.querySelectorAll(".key-white .key-name").forEach((el) => {
        el.style.display = showKey ? "" : "none";
    });
    document.querySelectorAll(".key-white .key-note").forEach((el) => {
        el.style.display = showNote ? "" : "none";
    });
    document.querySelectorAll(".key-black .key-shift-hint").forEach((el) => {
        el.style.display = showKey ? "" : "none";
    });
}

// Visual-only: set the .active class on the piano key and the matching
// diagram keys for this note. Press/release is tracked separately via
// holdNote / releaseNote so the highlight stays while a key is held.
// Multiple notes can be active at once (e.g. keyboard chord); mouse/touch
// drag cleanup is handled by pressMouseNote / pressTouchNote which release
// the previous note before holding the new one.
function activateByName(name) {
    document
        .querySelectorAll(`[data-name="${CSS.escape(name)}"]`)
        .forEach((el) => el.classList.add("active"));

    // Mirror the highlight onto the keyboard diagram for the bound physical
    // keys. The diagram may not be in the DOM during early init, so guard it.
    const diagram = document.getElementById("keyboard-diagram");
    const kbIds = noteToKbIds.get(name);
    if (diagram && kbIds && kbIds.length > 0) {
        kbIds.forEach((kbId) => {
            const kbEl = diagram.querySelector(`[data-kb-id="${kbId}"]`);
            if (kbEl) kbEl.classList.add("active");
        });
    }
}

// Press/release tracking: a note stays highlighted as long as at least one
// press source (mouse, touch, or a keyboard key) is still holding it.
const noteHoldCounts = new Map();

const localPedalNotes = {
    sustain: new Set(), 
    sostenuto: new Set(),
};

let mouseHeldNote = null;
let touchHeldNote = null;
const keyToHeldNote = new Map();

function setHighlight(name, on) {
    document
        .querySelectorAll(`[data-name="${CSS.escape(name)}"]`)
        .forEach((el) => {
            if (on) el.classList.add("active");
            else el.classList.remove("active");
        });
    const diagram = document.getElementById("keyboard-diagram");
    const kbIds = noteToKbIds.get(name);
    if (diagram && kbIds && kbIds.length > 0) {
        kbIds.forEach((kbId) => {
            const kbEl = diagram.querySelector(`[data-kb-id="${kbId}"]`);
            if (kbEl) {
                if (on) kbEl.classList.add("active");
                else kbEl.classList.remove("active");
            }
        });
    }
}

function holdNote(name, opts) {
    if (!name) return;
    const cur = noteHoldCounts.get(name) || 0;
    noteHoldCounts.set(name, cur + 1);
    if (cur === 0) {
        setHighlight(name, true);
        localPedalNotes.sustain.delete(name);
        localPedalNotes.sostenuto.delete(name);
        if (!(opts && opts.fromMidi)) sendMidiOutNoteOn(name);
    }
}

function releaseNote(name, opts) {
    if (!name) return;
    const cur = noteHoldCounts.get(name) || 0;
    if (cur <= 1) {
        noteHoldCounts.delete(name);
        const bySostenuto = localPedalNotes.sostenuto.has(name);
        const bySustain = PEDALS.sustain.local;
        if (bySostenuto || bySustain) {
            if (bySustain && !bySostenuto) localPedalNotes.sustain.add(name);
        } else {
            setHighlight(name, false);
            releaseKeyboardNote(name);
        }
        if (!(opts && opts.fromMidi)) sendMidiOutNoteOff(name);
    } else {
        noteHoldCounts.set(name, cur - 1);
    }
}
function releaseLocalPedalNotes(kind, into) {
    for (const name of Array.from(localPedalNotes[kind])) {
        localPedalNotes[kind].delete(name);
        if (noteHoldCounts.has(name)) continue;
        if (into) {
            localPedalNotes[into].add(name);
            continue;
        }
        setHighlight(name, false);
        releaseKeyboardNote(name);
    }
}

function captureLocalSostenuto() {
    localPedalNotes.sostenuto.clear();
    for (const name of noteHoldCounts.keys()) localPedalNotes.sostenuto.add(name);
}

// Stop a sounding SoundFont keyboard note when its key is released.
// Short presses (< SHORT_PRESS_THRESHOLD_MS) are let to ring for a total of
// ~SHORT_PRESS_RING_MS so a quick tap still feels like the old fixed-duration
// note; longer holds are stopped immediately so smplr's per-instrument release
// envelope fades the tail out naturally. The default-samples path has no
// stopFn (each MP3 has its own baked-in envelope) so this is a no-op there.
function releaseKeyboardNote(name) {
    const stopFn = keyboard.activeStops.get(name);
    if (!stopFn) return;
    const startTime = keyboard.activeStartTimes.get(name);
    const now = performance.now();
    const heldMs = startTime ? (now - startTime) : SHORT_PRESS_THRESHOLD_MS;
    keyboard.activeStartTimes.delete(name);
    if (heldMs < SHORT_PRESS_THRESHOLD_MS) {
        // Keep stopFn in activeStops so a quick re-trigger (playNote) can
        // find and stop this still-ringing note. The timer deletes it when
        // it fires. Otherwise the first note would never be stopped and
        // would bleed into the second press.
        const remaining = Math.max(0, SHORT_PRESS_RING_MS - heldMs);
        const timerId = setTimeout(() => {
            keyboard.activeShortReleaseTimers.delete(name);
            keyboard.activeStops.delete(name);
            try { stopFn(); } catch (_) {}
        }, remaining);
        keyboard.activeShortReleaseTimers.set(name, timerId);
    } else {
        keyboard.activeStops.delete(name);
        try { stopFn(); } catch (_) {}
    }
}

function releaseAllHeldNotes() {
    for (const name of noteHoldCounts.keys()) {
        setHighlight(name, false);
        releaseKeyboardNote(name);
    }
    noteHoldCounts.clear();
    localPedalNotes.sustain.clear();
    localPedalNotes.sostenuto.clear();
    mouseHeldNote = null;
    touchHeldNote = null;
    keyToHeldNote.clear();
    lastPointerTrigger = null;
    releaseAllLocalPedals();
    releaseAllMidiInNotes();
    midiDevice.panic();
}

function activateByKey(key, isBlackMode) {
    const note = resolveNote(key, isBlackMode);
    if (!note) return;
    playNote(note);
    activateByName(note.name);
}

// ---------- Keyboard ----------
const pressedKeys = new Set();
const lastPressAt = new Map();
const REPEAT_COOLDOWN_MS = 110;
// Black-key "modifier" is held-key based instead of a real modifier to avoid
// collisions with the OS / browser menu shortcuts. Hold ` (backtick) or
// Space while pressing a key to trigger that key's black note.
const blackModeKeys = new Set();

function isBlackModeActive() {
    return blackModeKeys.has("`") || blackModeKeys.has("Space");
}

// Look up the note triggered by a key, preferring the black variant when
// black-mode is active. Returns null if the key is not bound.
function resolveNote(key, isBlackMode) {
    if (isBlackMode) {
        const black = NOTES.find((n) => n.keys.includes(key) && n.type === "black");
        if (black) return black;
    }
    return NOTES.find((n) => n.keys.includes(key) && n.type === "white") || null;
}

window.addEventListener("keydown", (e) => {
    // Ignore typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.repeat) return; // OS-level repeat handled by cooldown

    // Track the black-mode enable keys. They aren't bound to any note
    // themselves, so we record state and bail out before the normal flow.
    if (e.code === "Backquote") {
        blackModeKeys.add("`");
        e.preventDefault();
        return;
    }
    if (e.code === "Space") {
        blackModeKeys.add("Space");
        e.preventDefault();
        return;
    }

    const pedalName = PEDAL_BY_CODE.get(e.code);
    if (pedalName) {
        e.preventDefault();
        setPedalLocal(pedalName, true);
        return;
    }

    const key = normalizeKey(e);
    if (!key) return;
    e.preventDefault();

    const now = performance.now();
    const last = lastPressAt.get(key) || 0;
    if (now - last < REPEAT_COOLDOWN_MS) return;
    lastPressAt.set(key, now);

    if (pressedKeys.has(key)) return;
    pressedKeys.add(key);

    const note = resolveNote(key, isBlackModeActive());
    if (note) {
        keyToHeldNote.set(key, note.name);
        holdNote(note.name);
    }

    activateByKey(key, isBlackModeActive());
});

window.addEventListener("keyup", (e) => {
    if (e.code === "Backquote") {
        blackModeKeys.delete("`");
        return;
    }
    if (e.code === "Space") {
        blackModeKeys.delete("Space");
        return;
    }
    const pedalName = PEDAL_BY_CODE.get(e.code);
    if (pedalName) {
        setPedalLocal(pedalName, false);
        return;
    }
    const key = normalizeKey(e);
    if (key) {
        pressedKeys.delete(key);
        const heldName = keyToHeldNote.get(key);
        if (heldName) {
            keyToHeldNote.delete(key);
            releaseNote(heldName);
        }
    }
});

window.addEventListener("blur", () => {
    pressedKeys.clear();
    blackModeKeys.clear();
    releaseAllHeldNotes();
});

// ---------- Mouse / touch ----------
// Tracks the last note the mouse/touch triggered so that dragging over the
// same key (or its inner label spans) doesn't re-fire the audio. The
// highlight is managed separately by holdNote / releaseNote and stays on
// for the full duration of the press.
let lastPointerTrigger = null;

function playFromElement(el, options) {
    if (!el) return;
    const name = el.dataset.name;
    if (!name) return;
    const note = NOTES.find((n) => n.name === name);
    if (!note) return;
    if (!options || options.skipAudioIfSame !== false) {
        if (lastPointerTrigger === name) {
            activateByName(name);
            return;
        }
    }
    lastPointerTrigger = name;
    playNote(note);
    activateByName(name);
}

// Wire mousedown / mouseover (drag) / touchstart to any key container — the
// original piano and both touch-mode rows share the same key markup (class
// .key-white / .key-black with data-name) and the same press semantics, so
// one helper wires them all up.
function attachKeyHandlers(container) {
    container.addEventListener("mousedown", (e) => {
        const el = e.target.closest(".key-white, .key-black");
        if (!el) return;
        e.preventDefault();
        pressMouseNote(el.dataset.name);
        playFromElement(el, { skipAudioIfSame: true });
    });

    container.addEventListener("mouseover", (e) => {
        if (e.buttons !== 1) return;
        const el = e.target.closest(".key-white, .key-black");
        if (!el) return;
        pressMouseNote(el.dataset.name);
        playFromElement(el, { skipAudioIfSame: true });
    });

    container.addEventListener("touchstart", (e) => {
        const el = e.target.closest(".key-white, .key-black");
        if (!el) return;
        e.preventDefault();
        pressTouchNote(el.dataset.name);
        playFromElement(el, { skipAudioIfSame: true });
    }, { passive: false });
}

// Release the held note when the mouse / touch is released anywhere on the
// page (including on a non-piano element, the diagram, or off the iframe).
window.addEventListener("mouseup", () => {
    if (mouseHeldNote) {
        releaseNote(mouseHeldNote);
        mouseHeldNote = null;
    }
    lastPointerTrigger = null;
});
window.addEventListener("touchend", () => {
    if (touchHeldNote) {
        releaseNote(touchHeldNote);
        touchHeldNote = null;
    }
    lastPointerTrigger = null;
});
window.addEventListener("touchcancel", () => {
    if (touchHeldNote) {
        releaseNote(touchHeldNote);
        touchHeldNote = null;
    }
    lastPointerTrigger = null;
});

function pressMouseNote(name) {
    if (mouseHeldNote && mouseHeldNote !== name) {
        releaseNote(mouseHeldNote);
    }
    if (mouseHeldNote !== name) {
        mouseHeldNote = name;
        holdNote(name);
    }
}

function pressTouchNote(name) {
    if (touchHeldNote && touchHeldNote !== name) {
        releaseNote(touchHeldNote);
    }
    if (touchHeldNote !== name) {
        touchHeldNote = name;
        holdNote(name);
    }
}

// ---------- Controls ----------
showKeyEl.addEventListener("change", setKeyVisible);
showNoteEl.addEventListener("change", setKeyVisible);



// ---------- Touch mode ----------
// Toggle the dual-row fullscreen piano for mobile / touch play. The state
// is persisted to localStorage so the choice survives page reloads. The
// piano + keyboard diagram are hidden while touch mode is on (the body
// class drives the CSS) and the two touch rows are lazily rendered on
// first activation to keep the initial DOM light.
const TOUCH_MODE_KEY = "fnpiano.touchMode";

// Detect a phone-sized device with a touch screen so we can auto-enable
// touch mode on the first visit. The user's explicit toggle always wins:
// once they turn it off (or on) we store "0"/"1" in localStorage and
// never auto-flip again.
function isMobileDevice() {
    if (typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 768px) and (pointer: coarse)").matches) {
        return true;
    }
    return /Android|webOS|iPhone|iPod|Opera Mini/i.test(navigator.userAgent || "");
}

// No more auto-rotate. The dual-row piano now adapts to the current
// orientation via CSS (portrait → 2 columns of vertical keys, landscape
// → 2 stacked rows of horizontal keys), so we just leave the device
// alone and let the layout respond.

function setTouchMode(on) {
    if (on) {
        if (!touchPianoRendered) renderTouchPiano();
        document.body.classList.add("touch-mode");
        touchPianoEl.hidden = false;
    } else {
        document.body.classList.remove("touch-mode");
        touchPianoEl.hidden = true;
    }
}

touchModeEl.addEventListener("change", () => {
    const on = touchModeEl.checked;
    setTouchMode(on);
    try { localStorage.setItem(TOUCH_MODE_KEY, on ? "1" : "0"); } catch (_) {}
});

// ---------- Rainbow mode ----------
// When on, each white-key pitch class (C/D/E/F/G/A/B) gets a soft pastel
// color. Driven by a body class so all three keyboards (main, touch
// high, touch low) recolor at once. The toggle state is persisted.
const RAINBOW_KEY = "fnpiano.rainbow";
const rainbowModeEl = document.getElementById("toggle-rainbow");

function setRainbowMode(on) {
    document.body.classList.toggle("rainbow-mode", on);
}

rainbowModeEl.addEventListener("change", () => {
    const on = rainbowModeEl.checked;
    setRainbowMode(on);
    try { localStorage.setItem(RAINBOW_KEY, on ? "1" : "0"); } catch (_) {}
});


const keyboardInstrumentEl = document.getElementById("midi-instrument");
const KEYBOARD_INSTRUMENT_KEY = "fnpiano.keyboardInstrument";

const INSTRUMENT_CN = {};
for (const opt of keyboardInstrumentEl.options) {
  if (opt.value && opt.value !== "default") INSTRUMENT_CN[opt.value] = opt.textContent;
}

const keyboard = {
    currentInstrument: "default", // "default" = samples/piano/*.mp3
    soundfont: null, // Soundfont instance for the active non-default instrument
    soundfontCache: new Map(), // instrument id -> Soundfont instance
    soundfontPromises: new Map(), // instrument id -> loading promise
    activeStops: new Map(), // note name -> stop fn returned by Soundfont.start()
    activeStartTimes: new Map(), // note name -> press timestamp (performance.now)
    activeShortReleaseTimers: new Map(), // note name -> pending short-release setTimeout id
    switchToken: 0, // increments on every instrument change so a slow load
    // for the previous instrument can't override the current one
};

// Map MusyngKite instrument id -> local SoundFont file shipped under
// static/soundfonts/. All files are MusyngKite OGG variants so the browser
// decodes them through the same path. Keep this list in sync with the
// non-default <option> entries in index.html.
const instrumentFileUrl = (instrument) => `soundfonts/${instrument}-ogg.js`;

// Load (or fetch from cache) the Soundfont for the given keyboard
// instrument. Returns null when the caller asks for the default ("default")
// so the caller can fall back to the MP3 sample path.
async function ensureKeyboardInstrument(instrument) {
    if (instrument === "default") return null;
    if (keyboard.soundfont && keyboard.currentInstrument === instrument) {
        return keyboard.soundfont;
    }
    let sf = keyboard.soundfontCache.get(instrument);
    if (!sf) {
        let loadPromise = keyboard.soundfontPromises.get(instrument);
        if (!loadPromise) {
            await initAudio();
            if (audio.ctx.state === "suspended") {
                try { await audio.ctx.resume(); } catch (_) {}
            }
            loadPromise = (async () => {
                const instance = new Soundfont(audio.ctx, {
                    instrument,
                    library: instrumentFileUrl,
                    destination: audio.master,
                    extraGain: 20,
                });
                await instance.loaded();
                keyboard.soundfontCache.set(instrument, instance);
                return instance;
            })();
            keyboard.soundfontPromises.set(instrument, loadPromise);
        }
        sf = await loadPromise;
    }
    // The user may have switched to a different instrument while the load
    // was in flight. In that case, leave keyboard.soundfont pointing at the
    // current active instrument and just return the newly loaded instance
    // (it's now in the cache for next time the user picks this one).
    if (keyboard.currentInstrument !== instrument) return sf;
    keyboard.soundfont = sf;
    return sf;
}

// Swap the keyboard's active instrument. Any notes still sounding from the
// previous instrument are cut off so the user doesn't get a stuck note when
// switching. A monotonically increasing token guards against an in-flight
// load for the old instrument winning the race and re-pointing the cache.
async function switchKeyboardInstrument(newInstrument) {
    if (newInstrument === keyboard.currentInstrument) return;
    for (const stopFn of keyboard.activeStops.values()) {
        try { stopFn(); } catch (_) {}
    }
    keyboard.activeStops.clear();
    keyboard.activeStartTimes.clear();
    for (const timerId of keyboard.activeShortReleaseTimers.values()) {
        clearTimeout(timerId);
    }
    keyboard.activeShortReleaseTimers.clear();
    const token = ++keyboard.switchToken;
    keyboard.currentInstrument = newInstrument;
    keyboard.soundfont = null;
    if (newInstrument === "default") return;
    try {
        await ensureKeyboardInstrument(newInstrument);
    } catch (err) {
        if (token !== keyboard.switchToken) return; // stale load
        console.error("Failed to load instrument:", err);
        alert("加载音色失败：" + (err && err.message ? err.message : err));
    }
}

keyboardInstrumentEl.addEventListener("change", () => {
    const v = keyboardInstrumentEl.value;
    try { localStorage.setItem(KEYBOARD_INSTRUMENT_KEY, v); } catch (_) {}
    switchKeyboardInstrument(v);
});

keyboardInstrumentEl.addEventListener("keydown", (e) => {
    if (e.code.startsWith("Arrow")) {
        e.preventDefault();
    }
});

// Restore the previously selected instrument on startup so the user's
// choice persists across reloads. Non-default selections are preloaded in
// the background so the first key press doesn't stall on the network/parse.
(function initKeyboardInstrumentSelection() {
    let saved = null;
    try { saved = localStorage.getItem(KEYBOARD_INSTRUMENT_KEY); } catch (_) {}
    if (saved && keyboardInstrumentEl.querySelector(`option[value="${saved}"]`)) {
        keyboardInstrumentEl.value = saved;
        keyboard.currentInstrument = saved;
        if (saved !== "default") ensureKeyboardInstrument(saved);
    } else {
        keyboardInstrumentEl.value = "default";
        keyboard.currentInstrument = "default";
    }
})();

// ---------- MIDI playback ----------
// Plays MIDI files using a fixed piano SoundFont (MusyngKite
// acoustic_grand_piano). The timbre of a MIDI is determined by the file's
// program-change events — using a single piano here is the simplest
// approximation. The top-bar 音色 selector is intentionally NOT wired
// here; it only affects the manual keyboard. The button in the top bar
// combines file selection + play/pause: a fresh click opens the file
// dialog, subsequent clicks toggle playback. Visual highlights on the
// piano keys are driven by the same scheduled timeline so the user can
// see which notes are being played.
const midiBtn = document.getElementById("midi-btn");
const midiFileInput = document.getElementById("midi-file");
const midiReloadBtn = document.getElementById("midi-reload");
const midiNameEl = document.getElementById("midi-name");
const midiVoiceConsole = document.getElementById("midi-voice-console");
const midiVoiceRows = new Map();  
const midiVoiceTimers = new Map();  

const MIDI_PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiToNoteName(midi) {
    const pitch = MIDI_PITCH_NAMES[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return pitch + octave;
}

const MIDI_PITCH_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteNameToMidi(name) {
    const m = /^([A-G]#?)(-?\d+)$/.exec(name || "");
    if (!m) return null;
    const semitone = MIDI_PITCH_INDEX[m[1][0]];
    if (semitone === undefined) return null;
    return (parseInt(m[2], 10) + 1) * 12 + semitone + (m[1].length === 2 ? 1 : 0);
}

const NOTE_BY_MIDI = new Map();
NOTES.forEach((note) => {
    const midi = noteNameToMidi(note.name);
    if (midi != null) NOTE_BY_MIDI.set(midi, note);
});

const FILE_CC = { sustain: 64, sostenuto: 66, soft: 67 };
const FILE_PEDAL_ON = 64 / 127;
const FILE_SUSTAIN_MAX_TAIL = 20;

const midi = {
    // 'idle' = no file, 'loaded' = file ready to play, 'playing' = sounding,
    // 'paused' = paused mid-track.
    status: "idle",
    fileName: null,
    notes: [], // {midi, name, time, duration, velocity, releaseTime, playDuration} sorted by time
    pedalEvents: [],
    pedalIndex: 0, 
    totalDuration: 0,
    soundfont: null, // Soundfont instance (always acoustic_grand_piano)
    soundfontLoad: null, // promise resolving when the Soundfont is ready
    channelPrograms: new Map(), 
    channelSf: new Map(),
    channelSfPromises: [], 
    ccEvents: [],      
    ccIndex: 0,
    ccState: new Map(), 
    ctxStartTime: 0, // AudioContext time at the most recent play()
    pausedAt: 0, // seconds elapsed in the MIDI timeline at the most recent pause
    visualTimers: [], // setTimeout ids for visual on/off callbacks
    stopFns: [], // stop() callbacks returned by Soundfont.start()
    highlightCounts: new Map(), // name -> active visual on count (for safe clear)
    endTimer: null, // setTimeout id that flips status back to "loaded" at track end
    maxPolyphony: 1024, // maximum simultaneous voices to prevent audio overload
    activeVoices: [], // {stopFn, endTime} for polyphony management
};

const PROGRAM_TO_SOUNDFONT = {
    // 钢琴 Piano (0-7)
    0: "acoustic_grand_piano", 1: "bright_acoustic_piano", 2: "electric_grand_piano", 3: "honkytonk_piano",
    4: "electric_piano_1", 5: "electric_piano_2", 6: "harpsichord", 7: "clavinet",
    // 半音打击乐器 Chromatic Percussion (8-15)
    8: "celesta", 9: "glockenspiel", 10: "music_box", 11: "vibraphone",
    12: "marimba", 13: "xylophone", 14: "tubular_bells", 15: "dulcimer",
    // 风琴 Organ (16-23)
    16: "drawbar_organ", 17: "percussive_organ", 18: "rock_organ", 19: "church_organ",
    20: "reed_organ", 21: "accordion", 22: "harmonica", 23: "tango_accordion",
    // 吉他 Guitar (24-31)
    24: "acoustic_guitar_nylon", 25: "acoustic_guitar_steel", 26: "electric_guitar_jazz", 27: "electric_guitar_clean",
    28: "electric_guitar_muted", 29: "overdriven_guitar", 30: "distortion_guitar", 31: "guitar_harmonics",
    // 贝斯 Bass (32-39)
    32: "acoustic_bass", 33: "electric_bass_finger", 34: "electric_bass_pick", 35: "fretless_bass",
    36: "slap_bass_1", 37: "slap_bass_2", 38: "synth_bass_1", 39: "synth_bass_2",
    // 弦乐器 Strings (40-47)
    40: "violin", 41: "viola", 42: "cello", 43: "contrabass",
    44: "tremolo_strings", 45: "pizzicato_strings", 46: "orchestral_harp", 47: "timpani",
    // 合奏 Ensemble (48-55)
    48: "string_ensemble_1", 49: "string_ensemble_2", 50: "synth_strings_1", 51: "synth_strings_2",
    52: "choir_aahs", 53: "voice_oohs", 54: "synth_choir", 55: "orchestra_hit",
    // 铜管乐器 Brass (56-63)
    56: "trumpet", 57: "trombone", 58: "tuba", 59: "muted_trumpet",
    60: "french_horn", 61: "brass_section", 62: "synth_brass_1", 63: "synth_brass_2",
    // 簧片乐器 Reed (64-71)
    64: "soprano_sax", 65: "alto_sax", 66: "tenor_sax", 67: "baritone_sax",
    68: "oboe", 69: "english_horn", 70: "bassoon", 71: "clarinet",
    // 吹管乐器 Pipe (72-79)
    72: "piccolo", 73: "flute", 74: "recorder", 75: "pan_flute",
    76: "blown_bottle", 77: "shakuhachi", 78: "whistle", 79: "ocarina",
    // 合成主音 Synth Lead (80-87)
    80: "lead_1_square", 81: "lead_2_sawtooth", 82: "lead_3_calliope", 83: "lead_4_chiff",
    84: "lead_5_charang", 85: "lead_6_voice", 86: "lead_7_fifths", 87: "lead_8_bass__lead",
    // 合成铺底 Synth Pad (88-95)
    88: "pad_1_new_age", 89: "pad_2_warm", 90: "pad_3_polysynth", 91: "pad_4_choir",
    92: "pad_5_bowed", 93: "pad_6_metallic", 94: "pad_7_halo", 95: "pad_8_sweep",
    // 合成效果 Synth Effects (96-103)
    96: "fx_1_rain", 97: "fx_2_soundtrack", 98: "fx_3_crystal", 99: "fx_4_atmosphere",
    100: "fx_5_brightness", 101: "fx_6_goblins", 102: "fx_7_echoes", 103: "fx_8_scifi",
    // 民族乐器 Ethnic (104-111)
    104: "sitar", 105: "banjo", 106: "shamisen", 107: "koto",
    108: "kalimba", 109: "bagpipe", 110: "fiddle", 111: "shanai",
    // 打击乐器 Percussive (112-119)
    112: "tinkle_bell", 113: "agogo", 114: "steel_drums", 115: "woodblock",
    116: "taiko_drum", 117: "melodic_tom", 118: "synth_drum", 119: "reverse_cymbal",
    // 特殊音效 Sound Effects (120-127)
    120: "guitar_fret_noise", 121: "breath_noise", 122: "seashore", 123: "bird_tweet",
    124: "telephone_ring", 125: "helicopter", 126: "applause", 127: "gunshot",
};
const FALLBACK_INSTRUMENT = "acoustic_grand_piano";
function normalizeProgram(program) {
    if (program == null) return 0;
    if (typeof program === "number") return program;
    if (typeof program === "string") {
        const n = Number(program);
        return Number.isNaN(n) ? 0 : n;
    }
    if (program.number != null) return normalizeProgram(program.number);
    if (program.program != null) return normalizeProgram(program.program);
    return 0;
}
const programSoundfonts = new Map();
const programSoundfontPromises = new Map();

async function getSoundfontById(id) {
    if (programSoundfonts.has(id)) return programSoundfonts.get(id);
    if (programSoundfontPromises.has(id)) return programSoundfontPromises.get(id);
    const p = (async () => {
        await initAudio();

        if (audio.ctx.state === "suspended") {
            try { await audio.ctx.resume(); } catch (_) {}
        }
        const instance = new Soundfont(audio.ctx, {
            instrument: id,
            library: instrumentFileUrl,
            destination: audio.master,
            extraGain: 20,
        });
        await instance.loaded();
        programSoundfonts.set(id, instance);
        return instance;
    })();
    programSoundfontPromises.set(id, p);
    return p;
}

function getSoundfontForProgram(program) {
    const p = normalizeProgram(program);
    const id = PROGRAM_TO_SOUNDFONT[p] || FALLBACK_INSTRUMENT;
    return getSoundfontById(id);
}

async function ensureSoundfont() {
    const sf = await getSoundfontById(FALLBACK_INSTRUMENT);
    midi.soundfont = sf;
    return sf;
}

function preloadMidiChannelSoundfonts() {
    midi.channelSfPromises = [];
    for (const [channel, program] of midi.channelPrograms) {
        midi.channelSfPromises.push(
            getSoundfontForProgram(program)
                .then((sf) => { midi.channelSf.set(channel, sf); })
                .catch((_) => {})
        );
    }
}

async function ensureMidiSoundfonts() {
    const loaders = [ensureSoundfont()];
    if (midi.channelSfPromises && midi.channelSfPromises.length) {
        loaders.push(...midi.channelSfPromises);
    }
    await Promise.all(loaders);
}

function updateMidiUI() {
    midiBtn.classList.toggle("is-playing", midi.status === "playing");
    const label = midiBtn.querySelector(".midi-btn-label");
    midiBtn.disabled = midi.status === "loading";
    if (midi.status === "idle") {
        label.textContent = "MIDI";
        midiBtn.title = "选择并播放 MIDI 文件";
    } else if (midi.status === "loading") {
        label.textContent = "加载…";
        midiBtn.title = "正在加载 MIDI";
    } else if (midi.status === "loaded") {
        label.textContent = "播放";
        midiBtn.title = midi.fileName ? `播放 ${midi.fileName}` : "播放";
    } else if (midi.status === "playing") {
        label.textContent = "暂停";
        midiBtn.title = midi.fileName ? `暂停 ${midi.fileName}` : "暂停";
    } else if (midi.status === "paused") {
        label.textContent = "继续";
        midiBtn.title = midi.fileName ? `继续 ${midi.fileName}` : "继续";
    }
    const hasFile = midi.fileName != null;
    midiReloadBtn.hidden = !hasFile;
    midiNameEl.hidden = !hasFile;
    if (hasFile) midiNameEl.textContent = midi.fileName;
}

function clearMidiVisualTimers() {
    for (const id of midi.visualTimers) clearTimeout(id);
    midi.visualTimers = [];
}

function clearMidiEndTimer() {
    if (midi.endTimer != null) {
        clearTimeout(midi.endTimer);
        midi.endTimer = null;
    }
}

// Called when the MIDI timeline reaches its end naturally. Flips the status
// back to "loaded" so the button reverts to 播放 and a fresh click replays
// from the beginning. Guarded so it doesn't clobber a manual pause/reset
// that happened in the meantime.
function onMidiPlaybackEnd() {
    midi.endTimer = null;
    if (midi.status !== "playing") return;
    clearMidiVisualTimers();
    stopMidiAudio();
    clearMidiHighlights();
    midi.pausedAt = 0;
    midi.ctxStartTime = 0;
    midi.status = "loaded";
    updateMidiUI();
}

function stopMidiAudio() {
    for (const fn of midi.stopFns) {
        try { fn(); } catch (_) {}
    }
    midi.stopFns = [];
    midi.activeVoices = [];
    const sfs = new Set(midi.channelSf.values());
    if (midi.soundfont) sfs.add(midi.soundfont);
    for (const sf of sfs) {
        try { sf.stop(); } catch (_) {}
    }
    clearFilePedals();
    midiDevice.panic();
}

// Manage polyphony by limiting simultaneous voices. When the limit is reached,
// steal the oldest voice (earliest endTime) to make room for the new one.
function addMidiVoice(stopFn, endTime) {
    const now = audio.ctx.currentTime;
    // Clean up expired voices
    midi.activeVoices = midi.activeVoices.filter(v => v.endTime > now);
    
    if (midi.activeVoices.length >= midi.maxPolyphony) {
        midi.activeVoices.sort((a, b) => a.endTime - b.endTime);
        const oldest = midi.activeVoices.shift();
        if (oldest && oldest.stopFn) {
            try { oldest.stopFn(); } catch (_) {}
        }
    }
    midi.activeVoices.push({ stopFn, endTime });
}

function clearMidiHighlights() {
    for (const name of midi.highlightCounts.keys()) {
        setHighlight(name, false);
    }
    midi.highlightCounts.clear();
}

function resetMidiPlaybackState() {
    clearMidiVisualTimers();
    clearMidiEndTimer();
    stopMidiAudio();
    clearMidiHighlights();
    midi.pausedAt = 0;
    midi.ctxStartTime = 0;
    midi.channelPrograms = new Map();
    midi.channelSf = new Map();
    midi.channelSfPromises = [];
    midi.pedalEvents = [];
    midi.pedalIndex = 0;
    midi.ccEvents = [];
    midi.ccIndex = 0;
    midi.ccState = new Map();
    clearFilePedals();
    updateVoiceConsole();
}

function trackControlChanges(track, cc) {
    const all = track && track.controlChanges;
    if (!all) return [];
    const list = all[cc];
    return Array.isArray(list) ? list : [];
}

function pedalIntervals(pedalEvents, name, channel) {
    const intervals = [];
    let open = null;
    for (const ev of pedalEvents) {
        if (ev.name !== name || ev.channel !== channel) continue;
        if (ev.on) {
            if (open == null) open = ev.time;
        } else if (open != null) {
            intervals.push({ down: open, up: ev.time });
            open = null;
        }
    }
    if (open != null) intervals.push({ down: open, up: Infinity });
    return intervals;
}

function applyPedalsToNotes(notes, pedalEvents) {
    if (!pedalEvents.length) {
        for (const note of notes) {
            note.releaseTime = note.time + note.duration;
            note.playDuration = note.duration;
        }
        return;
    }
    const sustain = new Map(); 
    const sostenuto = new Map();
    for (const note of notes) {
        if (sustain.has(note.channel)) continue;
        sustain.set(note.channel, pedalIntervals(pedalEvents, "sustain", note.channel));
        sostenuto.set(note.channel, pedalIntervals(pedalEvents, "sostenuto", note.channel));
    }
    for (const note of notes) {
        const end = note.time + note.duration;
        let release = end;
        const held = (sustain.get(note.channel) || []).find((iv) => end >= iv.down && end < iv.up);
        if (held) {
            release = Math.min(held.up, end + FILE_SUSTAIN_MAX_TAIL);
        } else {
            const frozen = (sostenuto.get(note.channel) || []).find(
                (iv) => note.time <= iv.down && end > iv.down && end < iv.up
            );
            if (frozen) release = Math.min(frozen.up, end + FILE_SUSTAIN_MAX_TAIL);
        }
        release = Math.max(release, end);
        note.releaseTime = release;
        note.playDuration = Math.max(release - note.time, note.duration, 0.01);
    }
}

function updateVoiceConsole() {
  if (!midiVoiceConsole) return;
  const programs = new Map();
  if (midi.channelPrograms) {
    for (const [ch, p] of midi.channelPrograms) programs.set(ch, p);
  }
  for (const [ch, p] of midiInState.programByChannel) programs.set(ch, p);
  if (programs.size === 0) {
    midiVoiceConsole.hidden = true;
    midiVoiceRows.clear();
    return;
  }
  midiVoiceConsole.hidden = false;
  midiVoiceRows.clear();
  const channels = [...programs.keys()].sort((a, b) => a - b);
  const rows = [];
  const VC_COLORS = [
    "#4f8cff", "#22b8a6", "#3ddc84", "#a3d33b",
    "#ffcf33", "#ff9f1c", "#ff6b4a", "#ff5c8a",
    "#c86bff", "#8b6bff", "#5ad0ff", "#39c5d6",
    "#7bd13b", "#ffd24d", "#ff7a59", "#e06bd6"
  ];
  for (const ch of channels) {
    const p = programs.get(ch);
    const inst = (PROGRAM_TO_SOUNDFONT[p]) || "acoustic_grand_piano";
    const cn = INSTRUMENT_CN[inst] || inst;
    const color = VC_COLORS[ch % VC_COLORS.length];
    rows.push(
      `<span class="vc-row" data-ch="${ch}" style="--vc-color:${color}">` +
      `<span class="vc-ch">通道 ${ch + 1}</span>` +
      `<span class="vc-name">${cn}</span>` +
      `<span class="vc-vol"><span class="vc-vol-fill" style="width:100%"></span></span></span>`
    );
  }
  midiVoiceConsole.innerHTML = rows.join("");
  midiVoiceConsole.querySelectorAll(".vc-row").forEach((el) => {
    const ch = Number(el.dataset.ch);
    midiVoiceRows.set(ch, el);
    const st = midiInState.ccByChannel.get(ch);
    if (st) {
      const level = (st.cc7 ?? 1) * (st.cc11 ?? 1);
      const fill = el.querySelector(".vc-vol-fill");
      if (fill) fill.style.width = Math.round(Math.max(0, Math.min(1, level)) * 100) + "%";
    }
  });
}

function markVoiceActive(channel, endTime) {
  const row = midiVoiceRows.get(channel);
  if (!row) return;
  row.classList.add("active");
  const prev = midiVoiceTimers.get(channel);
  if (prev) clearTimeout(prev);
  if (endTime == null) {
    midiVoiceTimers.delete(channel);
    return;
  }
  const delay = Math.max(0, (endTime - audio.ctx.currentTime) * 1000);
  midiVoiceTimers.set(channel, setTimeout(() => {
    row.classList.remove("active");
    midiVoiceTimers.delete(channel);
  }, delay));
}

function clearVoiceActive(channel) {
  const row = midiVoiceRows.get(channel);
  if (!row) return;
  const prev = midiVoiceTimers.get(channel);
  if (prev) clearTimeout(prev);
  midiVoiceTimers.delete(channel);
  row.classList.remove("active");
}

function updateVoiceConsoleVolume(channel, level) {
  const row = midiVoiceRows.get(channel);
  if (!row) return;
  const fill = row.querySelector(".vc-vol-fill");
  if (fill) {
    fill.style.width = Math.round(Math.max(0, Math.min(1, level)) * 100) + "%";
  }
}

async function loadMidiFile(file) {
    resetMidiPlaybackState();
    midi.status = "loading";
    midi.fileName = file.name;
    updateMidiUI();
    try {
        const buf = await file.arrayBuffer();
        const midiData = new Midi(buf);
        const notes = [];
        const channelCandidates = new Map();
        function considerChannelProgram(ch, program, hasNotes) {
            const cur = channelCandidates.get(ch);
            if (!cur) {
                channelCandidates.set(ch, { program, hasNotes });
                return;
            }
            if (program === 0) return; 
            if (cur.program === 0) {
                channelCandidates.set(ch, { program, hasNotes });
            } else if (hasNotes && !cur.hasNotes) {
                channelCandidates.set(ch, { program, hasNotes });
            }
        }
        for (const track of midiData.tracks) {
            const ch = track.channel == null ? 0 : track.channel;
            if (ch === 9) continue;
            considerChannelProgram(ch, normalizeProgram(track.instrument), track.notes.length > 0);
        }
        const channelPrograms = new Map();
        for (const [ch, cand] of channelCandidates) {
            channelPrograms.set(ch, cand.program);
        }
        for (const track of midiData.tracks) {
            const ch = track.channel == null ? 0 : track.channel;
            if (ch === 9) continue; 
            for (const note of track.notes) {
                if (note.midi < 0 || note.midi > 127) continue;
                notes.push({
                    midi: note.midi,
                    name: midiToNoteName(note.midi),
                    time: note.time,
                    duration: Math.max(note.duration, 0.01),
                    velocity: note.velocity,
                    channel: ch,
                });
            }
        }
        const pedalEvents = [];
        for (const track of midiData.tracks) {
            const ch = track.channel == null ? 0 : track.channel;
            for (const name of Object.keys(FILE_CC)) {
                const cc = FILE_CC[name];
                for (const ev of trackControlChanges(track, cc)) {
                    pedalEvents.push({
                        time: ev.time,
                        name,
                        cc,
                        channel: ch,
                        on: (ev.value || 0) >= FILE_PEDAL_ON,
                    });
                }
            }
        }
        pedalEvents.sort((a, b) => a.time - b.time);

        const ccEvents = [];
        for (const track of midiData.tracks) {
            const ch = track.channel == null ? 0 : track.channel;
            if (ch === 9) continue;
            for (const cc of [7, 11]) {
                for (const ev of trackControlChanges(track, cc)) {
                    ccEvents.push({ time: ev.time, channel: ch, cc, value: ev.value || 0 });
                }
            }
        }
        ccEvents.sort((a, b) => a.time - b.time);

        notes.sort((a, b) => a.time - b.time);
        applyPedalsToNotes(notes, pedalEvents);
        midi.notes = notes;
        midi.pedalEvents = pedalEvents;
        midi.ccEvents = ccEvents;
        midi.channelPrograms = channelPrograms;
        updateVoiceConsole();
        preloadMidiChannelSoundfonts();
        midi.totalDuration = midiData.duration || 0;
        for (const note of notes) {
            if (note.releaseTime > midi.totalDuration) midi.totalDuration = note.releaseTime;
        }
        midi.status = "loaded";
    } catch (err) {
        console.error("Failed to load MIDI:", err);
        midi.fileName = null;
        midi.notes = [];
        midi.pedalEvents = [];
        midi.ccEvents = [];
        midi.totalDuration = 0;
        midi.status = "idle";
        alert("无法加载 MIDI 文件：" + (err && err.message ? err.message : err));
    }
    updateMidiUI();
}

// Visual highlight helpers: refcount so back-to-back notes of the same pitch
// don't flicker off between them.
function midiHighlightOn(name) {
    const cur = midi.highlightCounts.get(name) || 0;
    midi.highlightCounts.set(name, cur + 1);
    if (cur === 0) setHighlight(name, true);
}
function midiHighlightOff(name) {
    const cur = midi.highlightCounts.get(name) || 0;
    if (cur <= 1) {
        midi.highlightCounts.delete(name);
        setHighlight(name, false);
    } else {
        midi.highlightCounts.set(name, cur - 1);
    }
}

function scheduleFrom(elapsed) {
    if (!midi.soundfont) return;
    midi.ctxStartTime = audio.ctx.currentTime;
    midi.scheduleIndex = 0;
    midi.pedalIndex = 0;
    midi.ccIndex = 0;
    midi.ccState = new Map();
    for (const sf of midi.channelSf.values()) {
        if (typeof sf.setVolume === "function") sf.setVolume(100);
    }
    for (const [ch] of midiVoiceRows) {
        updateVoiceConsoleVolume(ch, 1);
    }
    midi.schedulerTimer = null;
    midi.highlightIndex = 0;
    midi.highlightRaf = null;

    const SCHEDULE_AHEAD = 2.0;
    const CHECK_INTERVAL = 50;

    // Build highlight events array (ON and OFF events sorted by time)
    midi.highlightEvents = [];
    for (const note of midi.notes) {
        if (note.releaseTime <= elapsed) continue;
        midi.highlightEvents.push({ time: note.time, type: 'on', name: note.name, channel: note.channel });
        midi.highlightEvents.push({ time: note.releaseTime, type: 'off', name: note.name, channel: note.channel });
    }
    const initialPedal = new Map();
    for (const ev of midi.pedalEvents) {
        if (ev.time <= elapsed) {
            initialPedal.set(ev.name, ev.on);
            continue;
        }
        midi.highlightEvents.push({ time: ev.time, type: 'pedal', name: ev.name, on: ev.on });
    }
    midi.highlightEvents.sort((a, b) => a.time - b.time);
    for (const [name, on] of initialPedal) {
        if (!on) continue;
        setPedalFile(name, true);
        scheduleMidiOutControlChange(FILE_CC[name], 127, midi.ctxStartTime);
    }

    // Audio lookahead scheduler
    function schedulerTick() {
        if (midi.status !== "playing") return;
        const currentTime = audio.ctx.currentTime - midi.ctxStartTime + elapsed;
        const scheduleUntil = currentTime + SCHEDULE_AHEAD;

        while (midi.scheduleIndex < midi.notes.length) {
            const note = midi.notes[midi.scheduleIndex];
            if (note.time > scheduleUntil) break;

            const offset = note.time - elapsed;
            const audioTime = midi.ctxStartTime + offset;

            if (note.releaseTime > currentTime) {
                const vel = Math.max(0.05, Math.min(1, note.velocity || 0.8)) * 127;
                const sf = midi.channelSf.get(note.channel) || midi.soundfont;
                try {
                    const stopFn = sf.start({
                        note: note.name,
                        time: audioTime,
                        duration: note.playDuration,
                        velocity: vel,
                    });
                    if (typeof stopFn === "function") {
                        midi.stopFns.push(stopFn);
                        addMidiVoice(stopFn, audioTime + note.playDuration);
                        markVoiceActive(note.channel, audioTime + note.playDuration);
                    }
                } catch (err) {}
                scheduleMidiOutNote(note, audioTime, vel);
            }

            midi.scheduleIndex++;
        }

        while (midi.pedalIndex < midi.pedalEvents.length) {
            const ev = midi.pedalEvents[midi.pedalIndex];
            if (ev.time > scheduleUntil) break;
            scheduleMidiOutControlChange(
                ev.cc,
                ev.on ? 127 : 0,
                midi.ctxStartTime + (ev.time - elapsed)
            );
            midi.pedalIndex++;
        }

        while (midi.ccIndex < midi.ccEvents.length) {
            const ev = midi.ccEvents[midi.ccIndex];
            if (ev.time > scheduleUntil) break;
            const st = midi.ccState.get(ev.channel) || { cc7: 1, cc11: 1 };
            if (ev.cc === 7) st.cc7 = ev.value;
            else if (ev.cc === 11) st.cc11 = ev.value;
            midi.ccState.set(ev.channel, st);
            const ch = ev.channel, cc7 = st.cc7, cc11 = st.cc11;
            const audioTime = midi.ctxStartTime + (ev.time - elapsed);
            const delayMs = (audioTime - audio.ctx.currentTime) * 1000;
            const apply = () => {
                const sf = midi.channelSf.get(ch);
                if (sf && typeof sf.setVolume === "function") {
                    sf.setVolume(cc7 * cc11 * 100);
                }
                updateVoiceConsoleVolume(ch, cc7 * cc11);
            };
            if (delayMs <= 0) apply();
            else setTimeout(apply, delayMs);
            scheduleMidiOutControlChange(ev.cc, ev.value * 127, audioTime);
            midi.ccIndex++;
        }

        if (midi.scheduleIndex >= midi.notes.length) {
            clearMidiEndTimer();
            const remaining = midi.totalDuration - elapsed;
            if (remaining > 0) {
                midi.endTimer = setTimeout(onMidiPlaybackEnd, remaining * 1000);
            } else {
                onMidiPlaybackEnd();
            }
        } else {
            midi.schedulerTimer = setTimeout(schedulerTick, CHECK_INTERVAL);
        }
    }

    // Highlight scheduler using requestAnimationFrame with AudioContext clock
    function highlightLoop() {
        if (midi.status !== "playing") return;
        const currentTime = audio.ctx.currentTime - midi.ctxStartTime + elapsed;

        // Process all events up to current time
        while (midi.highlightIndex < midi.highlightEvents.length) {
            const event = midi.highlightEvents[midi.highlightIndex];
            if (event.time > currentTime) break;

            if (event.type === 'on') {
                midiHighlightOn(event.name);
            } else if (event.type === 'off') {
                midiHighlightOff(event.name);
            } else if (event.type === 'pedal') {
                setPedalFile(event.name, event.on);
            }
            midi.highlightIndex++;
        }

        if (midi.highlightIndex < midi.highlightEvents.length) {
            midi.highlightRaf = requestAnimationFrame(highlightLoop);
        }
    }

    schedulerTick();
    highlightLoop();
}

function startMidiPlayback() {
    if (midi.status !== "loaded" && midi.status !== "paused") return;
    ensureMidiSoundfonts()
        .then(() => {
            // scheduleFrom() is allowed to run even if the user already
            // paused while the soundfont was loading.
            if (midi.status !== "loaded" && midi.status !== "paused") return;
            midi.status = "playing";
            updateMidiUI();
            scheduleFrom(midi.pausedAt);
        })
        .catch((err) => {
            console.error("Failed to load soundfont:", err);
            alert("加载音源失败：" + (err && err.message ? err.message : err));
        });
}

function pauseMidiPlayback() {
    if (midi.status !== "playing") return;
    const elapsed = midi.pausedAt + (audio.ctx.currentTime - midi.ctxStartTime);
    clearMidiVisualTimers();
    clearMidiEndTimer();
    stopMidiAudio();
    clearMidiHighlights();
    midi.pausedAt = elapsed;
    midi.ctxStartTime = 0;
    midi.status = "paused";
    updateMidiUI();
}

function resumeMidiPlayback() {
    if (midi.status !== "paused") return;
    startMidiPlayback();
}

function onMidiBtnClick() {
    if (midi.status === "loading") return;
    // Resume AudioContext immediately while we're still in the user-gesture
    // call stack. The async chain in ensureSoundfont() can lose the gesture
    // association on some browsers, so the safest place is here.
    if (audio.ctx && audio.ctx.state === "suspended") {
        audio.ctx.resume();
    }
    if (midi.status === "idle") {
        midiFileInput.click();
        return;
    }
    if (midi.status === "loaded") {
        startMidiPlayback();
        return;
    }
    if (midi.status === "playing") {
        pauseMidiPlayback();
        return;
    }
    if (midi.status === "paused") {
        resumeMidiPlayback();
        return;
    }
}

function onMidiFileChange(e) {
    const file = e.target.files && e.target.files[0];
    // Reset the input so the same file can be picked again later.
    e.target.value = "";
    if (!file) return;
    loadMidiFile(file);
}

function onMidiReloadClick() {
    // If currently playing, pause first so we don't leave audio hanging.
    if (midi.status === "playing") pauseMidiPlayback();
    resetMidiPlaybackState();
    midi.status = "idle";
    midi.fileName = null;
    midi.notes = [];
    midi.totalDuration = 0;
    updateMidiUI();
    midiFileInput.click();
}

midiBtn.addEventListener("click", onMidiBtnClick);
midiFileInput.addEventListener("change", onMidiFileChange);
midiReloadBtn.addEventListener("click", onMidiReloadClick);

// Drag-and-drop a MIDI file onto the page to load and play it.
function isMidiFile(file) {
    if (!file) return false;
    if (/\.(mid|midi)$/i.test(file.name)) return true;
    return /midi/i.test(file.type || "");
}
window.addEventListener("dragover", (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.items || []).some((it) => it.kind === "file")) {
        e.preventDefault();
    }
});
window.addEventListener("drop", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    const file = e.dataTransfer.files[0];
    if (!isMidiFile(file)) return;
    e.preventDefault();
    loadMidiFile(file);
});

updateMidiUI();

const midiLinkBtn = document.getElementById("midi-link-btn");
const midiLinkLabel = document.getElementById("midi-link-label");
const midiPanelEl = document.getElementById("midi-device-panel");
const midiStatusEl = document.getElementById("midi-device-status");
const midiInputSel = document.getElementById("midi-input-select");
const midiOutputSel = document.getElementById("midi-output-select");
const midiInToggle = document.getElementById("toggle-midi-in");
const midiOutToggle = document.getElementById("toggle-midi-out");
const midiVelocityEl = document.getElementById("midi-velocity");
const midiVelocityValEl = document.getElementById("midi-velocity-value");
const midiChannelSel = document.getElementById("midi-channel");
const pedalBtns = new Map(); 
const pedalStateEls = new Map(); 
document.querySelectorAll("[data-pedal]").forEach((el) => pedalBtns.set(el.dataset.pedal, el));
document.querySelectorAll("[data-pedal-state]").forEach((el) => pedalStateEls.set(el.dataset.pedal, el));

const PEDALS = {
    soft: {
        cc: 67, label: "弱音", code: "Period", kbId: "Period",
        local: false, device: false, file: false, pointer: false,
        send: (on) => midiDevice.sendSoft(on),
    },
    sostenuto: {
        cc: 66, label: "保持", code: "Slash", kbId: "Slash",
        local: false, device: false, file: false, pointer: false,
        send: (on) => midiDevice.sendSostenuto(on),
    },
    sustain: {
        cc: 64, label: "延音", code: "AltRight", kbId: "AltRight",
        local: false, device: false, file: false, pointer: false,
        send: (on) => midiDevice.sendSustain(on),
    },
};
const PEDAL_BY_CODE = new Map();
Object.keys(PEDALS).forEach((name) => {
    if (PEDALS[name].code) PEDAL_BY_CODE.set(PEDALS[name].code, name);
});

const MIDI_SETUP_KEY = "fnpiano.midiSetup.v2";
const MIDI_AUTOCONNECT_KEY = "fnpiano.midiAutoconnect";

const midiInState = {
    held: new Map(), 
    heldSound: new Map(),
    pedaled: new Set(), 
    sostenuto: new Set(),
    sustain: false,
    programByChannel: new Map(),
    ccByChannel: new Map(),
    sfByChannel: new Map(),
    heldCountByChannel: new Map(),
};

function deviceHeldCount(channel) {
    return midiInState.heldCountByChannel.get(channel) || 0;
}
function deviceHeldInc(channel) {
    const n = deviceHeldCount(channel) + 1;
    midiInState.heldCountByChannel.set(channel, n);
    return n;
}
function deviceHeldDec(channel) {
    const n = deviceHeldCount(channel) - 1;
    if (n <= 0) midiInState.heldCountByChannel.delete(channel);
    else midiInState.heldCountByChannel.set(channel, n);
    return Math.max(0, n);
}

function sendMidiOutNoteOn(name) {
    const midi = noteNameToMidi(name);
    if (midi == null) return;
    midiDevice.sendNoteOn(midi, midiDevice.velocity);
}

function sendMidiOutNoteOff(name) {
    const midi = noteNameToMidi(name);
    if (midi == null) return;
    midiDevice.sendNoteOff(midi);
}

function scheduleMidiOutNote(note, audioTime, velocity) {
    if (!midiDevice.outEnabled || !midiDevice.output) return;
    midiDevice.sendNoteOn(
        note.midi,
        velocity,
        midiDevice.channel,
        audioTimeToMidiTimestamp(audioTime, audio.ctx)
    );
    midiDevice.sendNoteOff(
        note.midi,
        midiDevice.channel,
        audioTimeToMidiTimestamp(audioTime + note.duration, audio.ctx)
    );
}

function scheduleMidiOutControlChange(cc, value, audioTime) {
    if (!midiDevice.outEnabled || !midiDevice.output) return;
    midiDevice.sendControlChange(
        cc,
        value,
        midiDevice.channel,
        audioTimeToMidiTimestamp(audioTime, audio.ctx)
    );
}


function onDeviceNoteOn(midi, velocity, channel) {
    const note = NOTE_BY_MIDI.get(midi);
    if (!note) return;
    midiInState.pedaled.delete(midi);
    midiInState.sostenuto.delete(midi);
    if (midiInState.held.has(midi)) {
        releaseNote(midiInState.held.get(midi), { fromMidi: true });
        stopDeviceSound(midi);
        midiInState.held.delete(midi);
        deviceHeldDec(channel);
    }
    midiInState.held.set(midi, note.name);
    deviceHeldInc(channel);
    if (!midiInState.programByChannel.has(channel)) {
        midiInState.programByChannel.set(channel, 0);
        updateVoiceConsole();
    }
    const program = midiInState.programByChannel.get(channel);
    playNoteViaProgram(note, velocity, program, midi, channel);
    holdNote(note.name, { fromMidi: true });
    markVoiceActive(channel);
}

function onDeviceNoteOff(midi, channel) {
    const name = midiInState.held.get(midi);
    if (name == null) return;
    midiInState.held.delete(midi);
    deviceHeldDec(channel);
    if (midiInState.sostenuto.has(midi)) return;
    if (midiInState.sustain) {
        midiInState.pedaled.add(midi); 
        return;
    }
    stopDeviceSound(midi);
    releaseNote(name, { fromMidi: true });
    if (deviceHeldCount(channel) === 0) clearVoiceActive(channel);
}

async function playNoteViaProgram(note, velocity, program, midi, channel) {
    if (!midiInState.held.has(midi)) return;
    const vel = clampVelocity(velocity);
    const startOn = async (sf) => {
        if (!sf) return false;
        if (!midiInState.held.has(midi)) return false;
        try {
            const stopFn = sf.start({
                note: note.name,
                time: audio.ctx.currentTime + 0.02,
                velocity: vel,
            });
            if (typeof stopFn !== "function") return false;
            midiInState.heldSound.set(midi, { program, stopFn });
            if (channel != null && typeof sf.setVolume === "function") {
                const st = midiInState.ccByChannel.get(channel) || { cc7: 1, cc11: 1 };
                sf.setVolume(st.cc7 * st.cc11 * 100);
                midiInState.sfByChannel.set(channel, sf);
            }
            return true;
        } catch (_) {
            return false;
        }
    };
    let sf;
    try { sf = await getSoundfontForProgram(program); } catch (_) { sf = null; }
    if (await startOn(sf)) return;
    try {
        const piano = await ensureSoundfont();
        await startOn(piano);
    } catch (_) {}
}

function stopDeviceSound(midi) {
    const s = midiInState.heldSound.get(midi);
    if (s && typeof s.stopFn === "function") {
        try { s.stopFn(); } catch (_) {}
    }
    midiInState.heldSound.delete(midi);
}

function onDeviceProgramChange(program, channel) {
    midiInState.programByChannel.set(channel, program);
    getSoundfontForProgram(program).catch((_) => {});
    updateVoiceConsole();
}

function onDeviceControlChange(cc, value, channel) {
    if (cc !== 7 && cc !== 11) return;
    const st = midiInState.ccByChannel.get(channel) || { cc7: 1, cc11: 1 };
    if (cc === 7) st.cc7 = value / 127;
    else st.cc11 = value / 127;
    midiInState.ccByChannel.set(channel, st);
    const level = st.cc7 * st.cc11;
    const sf = midiInState.sfByChannel.get(channel);
    if (sf && typeof sf.setVolume === "function") sf.setVolume(level * 100);
    updateVoiceConsoleVolume(channel, level);
}


function updatePedalUI(name) {
    const pedal = PEDALS[name];
    if (!pedal) return;
    const active = pedal.local || pedal.device || pedal.file;
    const btn = pedalBtns.get(name);
    const label = pedalStateEls.get(name);
    if (btn) btn.classList.toggle("is-down", active);
    if (label) {
        label.textContent = pedal.file ? "文件"
            : pedal.device ? "设备"
            : pedal.local ? "踩下"
            : "—";
    }
    const diagram = document.getElementById("keyboard-diagram");
    const kbEl = diagram && pedal.kbId
        ? diagram.querySelector(`[data-kb-id="${pedal.kbId}"]`)
        : null;
    if (kbEl) kbEl.classList.toggle("active", active);
}

function applySoftGain() {
    setSoftPedalGain(PEDALS.soft.local || PEDALS.soft.device || PEDALS.soft.file);
}

function setPedalFile(name, on) {
    const pedal = PEDALS[name];
    if (!pedal || pedal.file === on) return;
    pedal.file = on;
    if (name === "soft") applySoftGain();
    updatePedalUI(name);
}

function clearFilePedals() {
    Object.keys(PEDALS).forEach((name) => {
        if (!PEDALS[name].file) return;
        PEDALS[name].file = false;
        updatePedalUI(name);
    });
    applySoftGain();
}

function setPedalLocal(name, on) {
    const pedal = PEDALS[name];
    if (!pedal || pedal.local === on) return;
    pedal.local = on;
    pedal.send(on);
    if (name === "soft") {
        applySoftGain(); 
    } else if (name === "sostenuto") {
        if (on) captureLocalSostenuto();
        else releaseLocalPedalNotes("sostenuto", PEDALS.sustain.local ? "sustain" : null);
    } else if (name === "sustain" && !on) {
        releaseLocalPedalNotes("sustain");
    }
    updatePedalUI(name);
}

function setPedalDevice(name, on) {
    const pedal = PEDALS[name];
    if (!pedal) return;
    pedal.device = on;
    updatePedalUI(name);
}

function releaseAllLocalPedals() {
    Object.keys(PEDALS).forEach((name) => {
        PEDALS[name].pointer = false;
        setPedalLocal(name, false);
    });
}

function onDeviceSustain(on) {
    setPedalDevice("sustain", on);
    midiInState.sustain = on;
    if (on) return;
    for (const midi of Array.from(midiInState.pedaled)) {
        stopDeviceSound(midi);
        const note = NOTE_BY_MIDI.get(midi);
        if (note) releaseNote(note.name, { fromMidi: true });
    }
    midiInState.pedaled.clear();
}

function onDeviceSostenuto(on) {
    setPedalDevice("sostenuto", on);
    if (on) {
        for (const midi of midiInState.held.keys()) midiInState.sostenuto.add(midi);
        return;
    }
    for (const midi of Array.from(midiInState.sostenuto)) {
        midiInState.sostenuto.delete(midi);
        if (midiInState.held.has(midi)) continue; 
        stopDeviceSound(midi);
        const note = NOTE_BY_MIDI.get(midi);
        if (note) releaseNote(note.name, { fromMidi: true });
    }
}

function onDeviceSoft(on) {
    setPedalDevice("soft", on);
    applySoftGain();
}

function releaseAllMidiInNotes() {
    for (const midi of Array.from(midiInState.heldSound.keys())) stopDeviceSound(midi);
    for (const name of midiInState.held.values()) {
        releaseNote(name, { fromMidi: true });
    }
    for (const midi of midiInState.pedaled) {
        const note = NOTE_BY_MIDI.get(midi);
        if (note) releaseNote(note.name, { fromMidi: true });
    }
    for (const midi of midiInState.sostenuto) {
        const note = NOTE_BY_MIDI.get(midi);
        if (note && !midiInState.held.has(midi)) releaseNote(note.name, { fromMidi: true });
    }
    midiInState.held.clear();
    midiInState.pedaled.clear();
    midiInState.sostenuto.clear();
    midiInState.sustain = false;
    Object.keys(PEDALS).forEach((name) => {
        PEDALS[name].device = false;
        updatePedalUI(name);
    });
    applySoftGain();
}

midiDevice.onNoteOn = onDeviceNoteOn;
midiDevice.onNoteOff = onDeviceNoteOff;
midiDevice.onProgramChange = onDeviceProgramChange;
midiDevice.onControlChange = onDeviceControlChange;
midiDevice.onSustain = onDeviceSustain;
midiDevice.onSostenuto = onDeviceSostenuto;
midiDevice.onSoft = onDeviceSoft;
midiDevice.onAllNotesOff = releaseAllMidiInNotes;

function hasOption(select, value) {
    return Array.from(select.options).some((o) => o.value === value);
}

let midiInputChosen = false;

function renderMidiPorts() {
    const prevIn = midiDevice.inputId;
    const prevOut = midiDevice.outputId;

    midiInputSel.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "全部输入";
    midiInputSel.appendChild(allOpt);
    midiDevice.inputs.forEach((port) => {
        const o = document.createElement("option");
        o.value = port.id;
        o.textContent = port.name || port.id;
        midiInputSel.appendChild(o);
    });

    midiOutputSel.innerHTML = "";
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "不发送";
    midiOutputSel.appendChild(noneOpt);
    midiDevice.outputs.forEach((port) => {
        const o = document.createElement("option");
        o.value = port.id;
        o.textContent = port.name || port.id;
        midiOutputSel.appendChild(o);
    });

    if (!midiInputChosen && midiDevice.inputs.length) {
        midiDevice.inputId = midiDevice.inputs[0].id;
    } else {
        midiDevice.inputId = hasOption(midiInputSel, prevIn) ? prevIn : "all";
    }
    midiDevice.outputId =
        prevOut && hasOption(midiOutputSel, prevOut)
            ? prevOut
            : midiDevice.outputs[0]
            ? midiDevice.outputs[0].id
            : "";
}

function syncMidiControls() {
    midiInputSel.value = hasOption(midiInputSel, midiDevice.inputId) ? midiDevice.inputId : "all";
    midiOutputSel.value = hasOption(midiOutputSel, midiDevice.outputId) ? midiDevice.outputId : "";
    midiChannelSel.value = String(midiDevice.channel);
    midiVelocityEl.value = String(midiDevice.velocity);
    midiVelocityValEl.textContent = String(midiDevice.velocity);
    midiInToggle.checked = midiDevice.inEnabled;
    midiOutToggle.checked = midiDevice.outEnabled;
}

function updateMidiDeviceUI() {
    const hasAccess = !!midiDevice.access;
    const hasDevice = hasAccess && (midiDevice.inputs.length > 0 || midiDevice.outputs.length > 0);
    midiLinkBtn.classList.toggle("is-connected", hasDevice);
    if (!midiDevice.supported) {
        midiLinkLabel.textContent = "MIDI 不可用";
        midiStatusEl.textContent = "当前浏览器不支持 Web MIDI";
        midiLinkBtn.title = "当前浏览器不支持 Web MIDI";
    } else if (!hasAccess) {
        midiLinkLabel.textContent = "MIDI 设备";
        midiStatusEl.textContent = "未连接 · 点击按钮授权并连接";
    } else if (!hasDevice) {
        midiLinkLabel.textContent = "MIDI 设备";
        midiStatusEl.textContent = "已授权 · 未检测到 MIDI 设备";
    } else {
        midiStatusEl.textContent = `已连接 · 输入 ${midiDevice.inputs.length} · 输出 ${midiDevice.outputs.length}`;
        midiLinkLabel.textContent = "已连接";
    }
    midiInputSel.disabled = !hasAccess;
    midiOutputSel.disabled = !hasAccess;
    midiInToggle.disabled = !hasAccess;
    midiOutToggle.disabled = !hasAccess;
    pedalBtns.forEach((btn) => {
        btn.disabled = !hasAccess || !midiDevice.output;
    });
}

function saveMidiSetup() {
    try {
        localStorage.setItem(
            MIDI_SETUP_KEY,
            JSON.stringify({
                inputId: midiDevice.inputId,
                outputId: midiDevice.outputId,
                channel: midiDevice.channel,
                velocity: midiDevice.velocity,
                inEnabled: midiDevice.inEnabled,
                outEnabled: midiDevice.outEnabled,
            })
        );
    } catch (_) {}
}

function applyMidiSetup() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(MIDI_SETUP_KEY) || "null"); } catch (_) {}
    if (!saved || typeof saved !== "object") return;
    if (typeof saved.inputId === "string") {
        midiDevice.inputId = saved.inputId;
        midiInputChosen = true;
    }
    if (typeof saved.outputId === "string") midiDevice.outputId = saved.outputId;
    if (Number.isFinite(saved.channel)) midiDevice.channel = Math.max(0, Math.min(15, saved.channel | 0));
    if (Number.isFinite(saved.velocity)) midiDevice.velocity = Math.max(1, Math.min(127, saved.velocity | 0));
    if (typeof saved.inEnabled === "boolean") midiDevice.inEnabled = saved.inEnabled;
    if (typeof saved.outEnabled === "boolean") midiDevice.outEnabled = saved.outEnabled;
}

async function connectMidiDevice() {
    if (!midiDevice.supported) {
        updateMidiDeviceUI();
        alert("当前浏览器不支持 Web MIDI");
        return false;
    }
    midiStatusEl.textContent = "正在请求授权…";
    try {
        await midiDevice.connect();
        await initAudio();
        if (audio.ctx.state === "suspended") {
            try { await audio.ctx.resume(); } catch (_) {}
        }
        applyMidiSetup();
        renderMidiPorts();
        syncMidiControls();
        updateMidiDeviceUI();
        try { localStorage.setItem(MIDI_AUTOCONNECT_KEY, "1"); } catch (_) {}
        return true;
    } catch (err) {
        console.error("MIDI connect failed:", err);
        const msg = err && err.message ? err.message : String(err);
        midiStatusEl.textContent = "连接失败：" + msg;
        alert("无法连接 MIDI 设备：" + msg);
        updateMidiDeviceUI();
        return false;
    }
}

midiDevice.onPortsChange = () => {
    renderMidiPorts();
    syncMidiControls();
    updateMidiDeviceUI();
};

midiLinkBtn.addEventListener("click", async () => {
    const opening = midiPanelEl.hidden;
    midiPanelEl.hidden = !opening;
    if (!opening) {
        updateMidiDeviceUI();
        return;
    }
    updateMidiDeviceUI();
    if (!midiDevice.access) await connectMidiDevice();
});

document.addEventListener("pointerdown", (e) => {
    if (midiPanelEl.hidden) return;
    const wrap = midiLinkBtn.parentElement;
    if (wrap && wrap.contains(e.target)) return;
    midiPanelEl.hidden = true;
    updateMidiDeviceUI();
});

midiInputSel.addEventListener("change", () => {
    midiDevice.inputId = midiInputSel.value;
    midiInputChosen = true;
    releaseAllMidiInNotes();
    saveMidiSetup();
});

midiOutputSel.addEventListener("change", () => {
    midiDevice.panic(); // cut anything left ringing on the previous device
    midiDevice.outputId = midiOutputSel.value;
    saveMidiSetup();
    updateMidiDeviceUI();
});

midiInToggle.addEventListener("change", () => {
    midiDevice.inEnabled = midiInToggle.checked;
    if (!midiDevice.inEnabled) releaseAllMidiInNotes();
    saveMidiSetup();
});

midiOutToggle.addEventListener("change", () => {
    midiDevice.outEnabled = midiOutToggle.checked;
    if (!midiDevice.outEnabled) midiDevice.panic();
    saveMidiSetup();
});

midiVelocityEl.addEventListener("input", () => {
    midiDevice.velocity = parseInt(midiVelocityEl.value, 10) || 100;
    midiVelocityValEl.textContent = String(midiDevice.velocity);
});
midiVelocityEl.addEventListener("change", saveMidiSetup);

midiChannelSel.addEventListener("change", () => {
    midiDevice.panic(); // notes sent on the old channel would hang
    midiDevice.channel = parseInt(midiChannelSel.value, 10) || 0;
    saveMidiSetup();
});

pedalBtns.forEach((btn, name) => {
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        PEDALS[name].pointer = true;
        setPedalLocal(name, true);
    });
});

function releasePointerPedals() {
    Object.keys(PEDALS).forEach((name) => {
        if (!PEDALS[name].pointer) return;
        PEDALS[name].pointer = false;
        setPedalLocal(name, false);
    });
}
window.addEventListener("pointerup", releasePointerPedals);
window.addEventListener("pointercancel", releasePointerPedals);

(function initMidiChannelOptions() {
    for (let ch = 0; ch < 16; ch++) {
        const o = document.createElement("option");
        o.value = String(ch);
        o.textContent = String(ch + 1);
        midiChannelSel.appendChild(o);
    }
    midiChannelSel.value = "0";
})();

function armMidiAutoConnect() {
    if (!midiDevice.supported) return;
    let saved = null;
    try { saved = localStorage.getItem(MIDI_AUTOCONNECT_KEY); } catch (_) {}
    if (saved === "1") {
        midiDevice.connect().then(() => {
            applyMidiSetup();
            renderMidiPorts();
            syncMidiControls();
            updateMidiDeviceUI();
        }).catch(() => {});
        return;
    }
    const attempt = async () => {
        window.removeEventListener("click", attempt);
        window.removeEventListener("keydown", attempt);
        if (midiDevice.access) return;
        try {
            await midiDevice.connect();
            applyMidiSetup();
            renderMidiPorts();
            syncMidiControls();
            updateMidiDeviceUI();
        } catch (_) {
        }
    };
    window.addEventListener("click", attempt, { once: true });
    window.addEventListener("keydown", attempt, { once: true });
}

updateMidiDeviceUI();

// ---------- Init ----------
(async function init() {
    renderPiano();
    setKeyVisible();
    renderKeyboardDiagram();

    // Wire the touch row containers up regardless of touch mode — their
    // handlers are no-ops until the rows are actually rendered, but this
    // way toggling touch mode on at any point "just works".
    attachKeyHandlers(keysEl);
    attachKeyHandlers(touchKeysHighEl);
    attachKeyHandlers(touchKeysLowEl);

    // Restore / decide touch-mode preference. An explicit user choice
    // ("0" or "1") always wins; on the very first visit we fall back to
    // device detection so phones get touch mode out of the box.
    let savedValue = null;
    try { savedValue = localStorage.getItem(TOUCH_MODE_KEY); } catch (_) {}
    let shouldEnableTouch;
    if (savedValue === "1") shouldEnableTouch = true;
    else if (savedValue === "0") shouldEnableTouch = false;
    else shouldEnableTouch = isMobileDevice();
    if (shouldEnableTouch) {
        touchModeEl.checked = true;
        setTouchMode(true);
    }

    // No auto-rotate anymore. The dual-row touch piano adapts to whatever
    // orientation the device is in (portrait → 2 columns, landscape → 2
    // rows), so we just leave the screen alone.

    // Restore the saved rainbow-mode preference. Default off.
    let savedRainbow = null;
    try { savedRainbow = localStorage.getItem(RAINBOW_KEY); } catch (_) {}
    if (savedRainbow === "1") {
        rainbowModeEl.checked = true;
        setRainbowMode(true);
    }

    try {
        await loadAllSamples();
    } catch (err) {
        console.error(err);
    }

    // Resume audio context on first user gesture (Chrome autoplay policy)
    const resume = () => {
        if (audio.ctx && audio.ctx.state === "suspended") {
            audio.ctx.resume();
        }
        window.removeEventListener("click", resume);
        window.removeEventListener("keydown", resume);
    };
    window.addEventListener("click", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });

    // Keep keyboard focus inside the iframe so window keydown events fire
    // even when the page is embedded. Without this, clicks on a piano key
    // call preventDefault() and never transfer focus, so keys appear dead
    // until the user clicks a non-key area.
    const ensureIframeFocus = () => {
        try { window.focus(); } catch (_) {}
        const ae = document.activeElement;
        if (!ae || ae === document.body) {
            try { document.body.focus(); } catch (_) {}
            return;
        }
        if (ae.matches && ae.matches("input, textarea, select, [contenteditable]")) return;
        try { document.body.focus(); } catch (_) {}
    };
    window.addEventListener("pointerdown", ensureIframeFocus);
    window.addEventListener("touchstart", ensureIframeFocus);

    armMidiAutoConnect();
})();
