// Virtual Piano - main app
// Vanilla JS + Web Audio API, no build step.

const SAMPLE_BASE = "/samples/piano/";
const WHITE_COUNT = 36;

// Note layout. Each entry: name, keys (array of supported keys), file, type, whiteIndex.
// `keys` is a list of normalized key identifiers (see normalizeKey below).
// For black keys, the first key in the array is the "primary" key used with Ctrl
// to trigger the sharp note. For white keys, the first key is shown prominently
// and any additional keys (arrow keys, numpad keys) act as alternative bindings.
const NOTES = [
    // Octave 2 (white idx 0..6)
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

    // Octave 3 (white idx 7..13)
    { name: "C3", keys: ["8"], file: "a56.mp3", type: "white", whiteIndex: 7 },
    { name: "C#3", keys: ["8"], file: "b56.mp3", type: "black", whiteIndex: 7 },
    { name: "D3", keys: ["9"], file: "a57.mp3", type: "white", whiteIndex: 8 },
    { name: "D#3", keys: ["9"], file: "b57.mp3", type: "black", whiteIndex: 8 },
    { name: "E3", keys: ["0"], file: "a48.mp3", type: "white", whiteIndex: 9 },
    { name: "F3", keys: ["Q"], file: "a81.mp3", type: "white", whiteIndex: 10 },
    { name: "F#3", keys: ["Q"], file: "b81.mp3", type: "black", whiteIndex: 10 },
    { name: "G3", keys: ["W"], file: "a87.mp3", type: "white", whiteIndex: 11 },
    { name: "G#3", keys: ["W"], file: "b87.mp3", type: "black", whiteIndex: 11 },
    { name: "A3", keys: ["E"], file: "a69.mp3", type: "white", whiteIndex: 12 },
    { name: "A#3", keys: ["E"], file: "b69.mp3", type: "black", whiteIndex: 12 },
    { name: "B3", keys: ["R"], file: "a82.mp3", type: "white", whiteIndex: 13 },

    // Octave 4 (white idx 14..20) - C4..B4 also bound to arrow keys & numpad
    { name: "C4", keys: ["T", "ArrowLeft"], file: "a84.mp3", type: "white", whiteIndex: 14 },
    { name: "C#4", keys: ["T", "ArrowLeft"], file: "b84.mp3", type: "black", whiteIndex: 14 },
    { name: "D4", keys: ["Y", "ArrowUp"], file: "a89.mp3", type: "white", whiteIndex: 15 },
    { name: "D#4", keys: ["Y", "ArrowUp"], file: "b89.mp3", type: "black", whiteIndex: 15 },
    { name: "E4", keys: ["U", "ArrowDown"], file: "a85.mp3", type: "white", whiteIndex: 16 },
    { name: "F4", keys: ["I", "ArrowRight"], file: "a73.mp3", type: "white", whiteIndex: 17 },
    { name: "F#4", keys: ["I", "ArrowRight"], file: "b73.mp3", type: "black", whiteIndex: 17 },
    { name: "G4", keys: ["O", "Numpad0"], file: "a79.mp3", type: "white", whiteIndex: 18 },
    { name: "G#4", keys: ["O", "Numpad0"], file: "b79.mp3", type: "black", whiteIndex: 18 },
    { name: "A4", keys: ["P", "NumpadDecimal"], file: "a80.mp3", type: "white", whiteIndex: 19 },
    { name: "A#4", keys: ["P", "NumpadDecimal"], file: "b80.mp3", type: "black", whiteIndex: 19 },
    { name: "B4", keys: ["A", "NumpadEnter"], file: "a65.mp3", type: "white", whiteIndex: 20 },

    // Octave 5 (white idx 21..27) - C5..B5 also bound to numpad digits
    { name: "C5", keys: ["S", "Numpad1"], file: "a83.mp3", type: "white", whiteIndex: 21 },
    { name: "C#5", keys: ["S", "Numpad1"], file: "b83.mp3", type: "black", whiteIndex: 21 },
    { name: "D5", keys: ["D", "Numpad2"], file: "a68.mp3", type: "white", whiteIndex: 22 },
    { name: "D#5", keys: ["D", "Numpad2"], file: "b68.mp3", type: "black", whiteIndex: 22 },
    { name: "E5", keys: ["F", "Numpad3"], file: "a70.mp3", type: "white", whiteIndex: 23 },
    { name: "F5", keys: ["G", "Numpad4"], file: "a71.mp3", type: "white", whiteIndex: 24 },
    { name: "F#5", keys: ["G", "Numpad4"], file: "b71.mp3", type: "black", whiteIndex: 24 },
    { name: "G5", keys: ["H", "Numpad5"], file: "a72.mp3", type: "white", whiteIndex: 25 },
    { name: "G#5", keys: ["H", "Numpad5"], file: "b72.mp3", type: "black", whiteIndex: 25 },
    { name: "A5", keys: ["J", "Numpad6"], file: "a74.mp3", type: "white", whiteIndex: 26 },
    { name: "A#5", keys: ["J", "Numpad6"], file: "b74.mp3", type: "black", whiteIndex: 26 },
    { name: "B5", keys: ["K", "Numpad7"], file: "a75.mp3", type: "white", whiteIndex: 27 },

    // Octave 6 (white idx 28..33) - C6..B6 also bound to numpad 8/9/+/Num///*/-
    { name: "C6", keys: ["L", "Numpad8"], file: "a76.mp3", type: "white", whiteIndex: 28 },
    { name: "C#6", keys: ["L", "Numpad8"], file: "b76.mp3", type: "black", whiteIndex: 28 },
    { name: "D6", keys: ["Z", "Numpad9"], file: "a90.mp3", type: "white", whiteIndex: 29 },
    { name: "D#6", keys: ["Z", "Numpad9"], file: "b90.mp3", type: "black", whiteIndex: 29 },
    { name: "E6", keys: ["X", "NumpadAdd"], file: "a88.mp3", type: "white", whiteIndex: 30 },
    { name: "F6", keys: ["C", "NumLock"], file: "a67.mp3", type: "white", whiteIndex: 31 },
    { name: "F#6", keys: ["C", "NumLock"], file: "b67.mp3", type: "black", whiteIndex: 31 },
    { name: "G6", keys: ["V", "NumpadDivide"], file: "a86.mp3", type: "white", whiteIndex: 32 },
    { name: "G#6", keys: ["V", "NumpadDivide"], file: "b86.mp3", type: "black", whiteIndex: 32 },
    { name: "A6", keys: ["B", "NumpadMultiply"], file: "a66.mp3", type: "white", whiteIndex: 33 },
    { name: "A#6", keys: ["B", "NumpadMultiply"], file: "b66.mp3", type: "black", whiteIndex: 33 },
    { name: "B6", keys: ["N", "NumpadSubtract"], file: "a78.mp3", type: "white", whiteIndex: 34 },

    // Octave 7 (white idx 35)
    { name: "C7", keys: ["M"], file: "a77.mp3", type: "white", whiteIndex: 35 },
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
        { id: "Backspace", label: "Bksp", w: 2, subLabel: "黑键" },
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
        { id: "Backslash", label: "\\", w: 2 },
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
        { id: "Enter", label: "Enter", w: 2, rowSpan: 1 },
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
        { id: "ShiftRight", label: "Shift", w: 1 },
        { id: "ArrowUp", label: "↑", w: 1 },
        { id: "", label: "", w: 2 },
        { id: "Numpad1", label: "1", w: 1 },
        { id: "Numpad2", label: "2", w: 1 },
        { id: "Numpad3", label: "3", w: 1 },
        { id: "NumpadEnter", label: "↵", w: 1, rowSpan: 2 },
    ],
    // Row 5: Ctrl Win Alt Space Alt Win Menu Ctrl
    [
        { id: "ControlLeft", label: "Ctrl", w: 1.25 },
        { id: "MetaLeft", label: "Win", w: 1.25 },
        { id: "AltLeft", label: "Alt", w: 1.25 },
        { id: "Space", label: "", w: 3 },
        { id: "Space", label: "", w: 3 },
        { id: "Space", label: "", w: 3 },
        { id: "Space", label: "", w: 1 },
        { id: "AltRight", label: "Alt", w: 1.25 },
        { id: "MetaRight", label: "Win", w: 1.25 },
        { id: "ContextMenu", label: "Menu", w: 1.25 },
        { id: "ControlRight", label: "Ctrl", w: 1.25 },
        { id: "ArrowLeft", label: "←", w: 1 },
        { id: "ArrowDown", label: "↓", w: 1 },
        { id: "ArrowRight", label: "→", w: 1 },
        { id: "", label: "", w: 1 },
        { id: "Numpad0", label: "0", w: 2 },
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
    const wKey = "w" + String(keyDef.w).replace(".", "_");
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
        // that the black key is triggered by holding ` or Backspace).
        notes.forEach((n) => {
            const nspan = document.createElement("span");
            nspan.className = n.type === "black" ? "kb-note-black" : "kb-note-white";
            nspan.textContent = (n.type === "black" ? "`" : "") + n.name;
            wrap.appendChild(nspan);
        });
        el.appendChild(wrap);

        // Clicking a diagram key triggers the bound note (white by default,
        // black note when the black-mode enable key — ` or Backspace — is held).
        el.addEventListener("mousedown", (ev) => {
            ev.preventDefault();
            let note = null;
            if (isBlackModeActive()) note = notes.find((n) => n.type === "black");
            if (!note) note = notes.find((n) => n.type === "white") || notes[0];
            if (note) {
                playNote(note);
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
    audio.master.gain.value = parseInt(volumeEl.value, 10) / 100;
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
    const buf = audio.buffers.get(note.file);
    if (!buf) return;
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(audio.master);
    src.start(0);
}

// ---------- DOM / render ----------
const pianoEl = document.getElementById("piano");
const keysEl = document.getElementById("keys");
const showKeyEl = document.getElementById("toggle-key");
const showNoteEl = document.getElementById("toggle-note");
const volumeEl = document.getElementById("volume");

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

function activateByName(name) {
    const el = keysEl.querySelector(`[data-name="${CSS.escape(name)}"]`);
    if (!el) return;
    // Clear active state from any other key so dragging leaves a clean trail
    // and previously highlighted keys always recover.
    keysEl.querySelectorAll(".key-white.active, .key-black.active").forEach((k) => {
        if (k !== el) k.classList.remove("active");
    });
    el.classList.add("active");
    if (activateByName._t) clearTimeout(activateByName._t);
    activateByName._t = setTimeout(() => el.classList.remove("active"), 220);

    // Mirror the highlight onto the keyboard diagram for the bound physical
    // keys. The diagram may not be in the DOM during early init, so guard it.
    const diagram = document.getElementById("keyboard-diagram");
    const kbIds = noteToKbIds.get(name);
    if (diagram && kbIds && kbIds.length > 0) {
        diagram.querySelectorAll(".kb-key.active").forEach((k) => k.classList.remove("active"));
        const matched = [];
        kbIds.forEach((kbId) => {
            const kbEl = diagram.querySelector(`[data-kb-id="${kbId}"]`);
            if (kbEl) {
                kbEl.classList.add("active");
                matched.push(kbEl);
            }
        });
        if (activateByName._kbT) clearTimeout(activateByName._kbT);
        activateByName._kbT = setTimeout(() => {
            matched.forEach((k) => k.classList.remove("active"));
        }, 220);
    }
}

function activateByKey(key, isBlackMode) {
    // Prefer the black key when black-mode is active (the primary key in the
    // note's `keys` list is the one used with ` or Backspace held).
    let note = null;
    if (isBlackMode) {
        note = NOTES.find((n) => n.keys.includes(key) && n.type === "black");
    }
    if (!note) note = NOTES.find((n) => n.keys.includes(key) && n.type === "white");
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
// Backspace while pressing a key to trigger that key's black note.
const blackModeKeys = new Set();

function isBlackModeActive() {
    return blackModeKeys.has("`") || blackModeKeys.has("Backspace");
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
    if (e.key === "Backspace") {
        blackModeKeys.add("Backspace");
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

    activateByKey(key, isBlackModeActive());
});

window.addEventListener("keyup", (e) => {
    if (e.code === "Backquote") {
        blackModeKeys.delete("`");
        return;
    }
    if (e.key === "Backspace") {
        blackModeKeys.delete("Backspace");
        return;
    }
    const key = normalizeKey(e);
    if (key) pressedKeys.delete(key);
});

window.addEventListener("blur", () => {
    pressedKeys.clear();
    blackModeKeys.clear();
});

// ---------- Mouse / touch ----------
function playFromElement(el) {
    if (!el) return;
    const name = el.dataset.name;
    if (!name) return;
    const note = NOTES.find((n) => n.name === name);
    if (!note) return;
    playNote(note);
    activateByName(name);
}

keysEl.addEventListener("mousedown", (e) => {
    const el = e.target.closest(".key-white, .key-black");
    if (!el) return;
    e.preventDefault();
    playFromElement(el);
});

keysEl.addEventListener("mouseover", (e) => {
    if (e.buttons !== 1) return;
    const el = e.target.closest(".key-white, .key-black");
    if (!el) return;
    playFromElement(el);
});

keysEl.addEventListener("touchstart", (e) => {
    const el = e.target.closest(".key-white, .key-black");
    if (!el) return;
    e.preventDefault();
    playFromElement(el);
}, { passive: false });

// ---------- Controls ----------
showKeyEl.addEventListener("change", setKeyVisible);
showNoteEl.addEventListener("change", setKeyVisible);

volumeEl.addEventListener("input", () => {
    if (audio.master) {
        audio.master.gain.value = parseInt(volumeEl.value, 10) / 100;
    }
});

// ---------- Init ----------
(async function init() {
    renderPiano();
    setKeyVisible();
    renderKeyboardDiagram();

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
})();
