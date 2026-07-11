// Virtual Piano - main app
// Vanilla JS + Web Audio API, no build step.

import { Soundfont } from "./vendor/smplr.mjs";
import { Midi } from "./vendor/tonejs-midi.mjs";

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
        { id: "Period", label: ".", w: 1 },
        { id: "Slash", label: "/", w: 1 },
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
        { id: "AltRight", label: "Alt", w: 1 },
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
    buffers: new Map(), // file -> AudioBuffer
    loadProgress: 0,
    loadTotal: 0,
};

async function initAudio() {
    if (audio.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 1.0;
    audio.master.connect(audio.ctx.destination);
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

function playNote(note) {
    if (!audio.ctx) return;
    // Default selection: original per-key MP3 samples. Other selections go
    // through the loaded Soundfont so the user hears the chosen timbre.
    if (keyboard.currentInstrument === "default") {
        const buf = audio.buffers.get(note.file);
        if (!buf) return;
        const src = audio.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(audio.master);
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
                velocity: 100,
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

function holdNote(name) {
    if (!name) return;
    const cur = noteHoldCounts.get(name) || 0;
    noteHoldCounts.set(name, cur + 1);
    if (cur === 0) setHighlight(name, true);
}

function releaseNote(name) {
    if (!name) return;
    const cur = noteHoldCounts.get(name) || 0;
    if (cur <= 1) {
        noteHoldCounts.delete(name);
        setHighlight(name, false);
        releaseKeyboardNote(name);
    } else {
        noteHoldCounts.set(name, cur - 1);
    }
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
    mouseHeldNote = null;
    touchHeldNote = null;
    keyToHeldNote.clear();
    lastPointerTrigger = null;
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

// ---------- Keyboard instrument ----------
// The top-bar 音色 dropdown changes the timbre of the on-screen piano
// (manual keyboard + touch). The default "default" option uses the original
// MP3 samples under samples/piano/. Any other option loads the matching
// MusyngKite SoundFont on demand and plays the keys through it. MIDI file
// playback deliberately uses a fixed piano SoundFont — the timbre of a
// MIDI is determined by the file's program-change events, not by this
// picker, so the selector and the MIDI player are decoupled.
const keyboardInstrumentEl = document.getElementById("midi-instrument");
const KEYBOARD_INSTRUMENT_KEY = "fnpiano.keyboardInstrument";

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

const MIDI_PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiToNoteName(midi) {
    const pitch = MIDI_PITCH_NAMES[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return pitch + octave;
}

const midi = {
    // 'idle' = no file, 'loaded' = file ready to play, 'playing' = sounding,
    // 'paused' = paused mid-track.
    status: "idle",
    fileName: null,
    notes: [], // {midi, name, time, duration, velocity} sorted by time
    totalDuration: 0,
    soundfont: null, // Soundfont instance (always acoustic_grand_piano)
    soundfontLoad: null, // promise resolving when the Soundfont is ready
    ctxStartTime: 0, // AudioContext time at the most recent play()
    pausedAt: 0, // seconds elapsed in the MIDI timeline at the most recent pause
    visualTimers: [], // setTimeout ids for visual on/off callbacks
    stopFns: [], // stop() callbacks returned by Soundfont.start()
    highlightCounts: new Map(), // name -> active visual on count (for safe clear)
    endTimer: null, // setTimeout id that flips status back to "loaded" at track end
    maxPolyphony: 1024, // maximum simultaneous voices to prevent audio overload
    activeVoices: [], // {stopFn, endTime} for polyphony management
};

// Load the (single) piano SoundFont used for MIDI playback. Cached in
// midi.soundfont after the first call so subsequent plays don't re-fetch.
async function ensureSoundfont() {
    if (midi.soundfont) {
        await midi.soundfontLoad;
        return midi.soundfont;
    }
    if (midi.soundfontLoad) {
        await midi.soundfontLoad;
        return midi.soundfont;
    }
    await initAudio();
    // AudioContext starts in "suspended" state under modern browser autoplay
    // policies. The MIDI button click is the user gesture that unlocks it, so
    // resuming here (instead of waiting for the global click/keydown listener
    // in init()) guarantees playback actually produces sound.
    if (audio.ctx.state === "suspended") {
        try { await audio.ctx.resume(); } catch (_) {}
    }
    // Route through audio.master so the topbar volume slider also affects
    // MIDI playback. extraGain boosts the smplr default (5) because the
    // local SoundFont samples decode to noticeably quieter buffers than
    // the default MusyngKite OGG library smplr is tuned for.
    midi.soundfontLoad = (async () => {
        midi.soundfont = new Soundfont(audio.ctx, {
            instrument: "acoustic_grand_piano",
            library: instrumentFileUrl,
            destination: audio.master,
            extraGain: 20,
        });
        await midi.soundfont.loaded();
    })();
    await midi.soundfontLoad;
    return midi.soundfont;
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
    if (midi.soundfont) {
        try { midi.soundfont.stop(); } catch (_) {}
    }
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
        for (const track of midiData.tracks) {
            if (track.channel === 9) continue; // skip drum track (channel 10 = 9 in 0-indexed)
            for (const note of track.notes) {
                if (note.midi < 0 || note.midi > 127) continue;
                notes.push({
                    midi: note.midi,
                    name: midiToNoteName(note.midi),
                    time: note.time,
                    duration: Math.max(note.duration, 0.01),
                    velocity: note.velocity,
                });
            }
        }
        notes.sort((a, b) => a.time - b.time);
        midi.notes = notes;
        midi.totalDuration = midiData.duration || 0;
        midi.status = "loaded";
    } catch (err) {
        console.error("Failed to load MIDI:", err);
        midi.fileName = null;
        midi.notes = [];
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
    midi.schedulerTimer = null;
    midi.highlightIndex = 0;
    midi.highlightRaf = null;

    const SCHEDULE_AHEAD = 2.0;
    const CHECK_INTERVAL = 50;

    // Build highlight events array (ON and OFF events sorted by time)
    midi.highlightEvents = [];
    for (const note of midi.notes) {
        if (note.time + note.duration <= elapsed) continue;
        midi.highlightEvents.push({ time: note.time, type: 'on', name: note.name });
        midi.highlightEvents.push({ time: note.time + note.duration, type: 'off', name: note.name });
    }
    midi.highlightEvents.sort((a, b) => a.time - b.time);

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

            if (note.time + note.duration > currentTime) {
                try {
                    const vel = Math.max(0.05, Math.min(1, note.velocity || 0.8)) * 127;
                    const stopFn = midi.soundfont.start({
                        note: note.name,
                        time: audioTime,
                        duration: note.duration,
                        velocity: vel,
                    });
                    if (typeof stopFn === "function") {
                        midi.stopFns.push(stopFn);
                        addMidiVoice(stopFn, audioTime + note.duration);
                    }
                } catch (err) {}
            }

            midi.scheduleIndex++;
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
            } else {
                midiHighlightOff(event.name);
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
    ensureSoundfont()
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
})();
