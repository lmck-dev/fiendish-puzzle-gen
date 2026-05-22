/* =============================================
   Fiendish Puzzle Gen — Cypher Tools Engine
   ============================================= */

(function () {
    "use strict";

    // ============================================
    // CONSTANTS & LOOKUP TABLES
    // ============================================

    const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const MORSE_MAP = {
        A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
        G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
        M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
        S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
        Y: "-.--", Z: "--..",
        "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
        "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----."
    };

    const MORSE_REVERSE = {};
    for (const [k, v] of Object.entries(MORSE_MAP)) MORSE_REVERSE[v] = k;

    const RUNE_MAP = {
        A: "ᚨ", B: "ᛒ", C: "ᚲ", D: "ᛞ", E: "ᛖ", F: "ᚠ", G: "ᚷ",
        H: "ᚺ", I: "ᛁ", J: "ᛃ", K: "ᚴ", L: "ᛚ", M: "ᛗ", N: "ᚾ",
        O: "ᛟ", P: "ᛈ", Q: "ᛩ", R: "ᚱ", S: "ᛊ", T: "ᛏ", U: "ᚢ",
        V: "ᚡ", W: "ᚹ", X: "ᛪ", Y: "ᛦ", Z: "ᛉ"
    };

    const RUNE_REVERSE = {};
    for (const [k, v] of Object.entries(RUNE_MAP)) RUNE_REVERSE[v] = k;

    // ============================================
    // PIGPEN SVG GENERATION
    // ============================================

    function createPigpenSVG(letter) {
        const ch = letter.toUpperCase();
        const code = ch.charCodeAt(0) - 65;
        if (code < 0 || code > 25) return `<span class="pigpen-char">${letter}</span>`;

        const s = 28, p = 5, e = s - p, m = s / 2;
        let pathParts = [];
        let hasDot = false;

        if (code < 18) {
            const idx = code < 9 ? code : code - 9;
            hasDot = code >= 9;
            const row = Math.floor(idx / 3);
            const col = idx % 3;

            if (col < 2) pathParts.push(`M${e},${p} L${e},${e}`);
            if (col > 0) pathParts.push(`M${p},${p} L${p},${e}`);
            if (row < 2) pathParts.push(`M${p},${e} L${e},${e}`);
            if (row > 0) pathParts.push(`M${p},${p} L${e},${p}`);
        } else {
            const idx = code < 22 ? code - 18 : code - 22;
            hasDot = code >= 22;
            const shapes = [
                `M${p},${e} L${m},${p} L${e},${e}`,
                `M${e},${p} L${p},${m} L${e},${e}`,
                `M${p},${p} L${e},${m} L${p},${e}`,
                `M${p},${p} L${m},${e} L${e},${p}`
            ];
            pathParts.push(shapes[idx]);
        }

        let svg = `<svg class="pigpen-glyph" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" role="img" aria-label="${ch}">`;
        for (const d of pathParts) {
            svg += `<path d="${d}" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        }
        if (hasDot) {
            svg += `<circle cx="${m}" cy="${m}" r="2.5" fill="currentColor"/>`;
        }
        svg += "</svg>";
        return svg;
    }

    // ============================================
    // HELPERS
    // ============================================

    function shiftChar(ch, shift) {
        if (/[A-Z]/.test(ch)) return ALPHA[(ch.charCodeAt(0) - 65 + shift + 260) % 26];
        if (/[a-z]/.test(ch)) return ALPHA[(ch.charCodeAt(0) - 97 + shift + 260) % 26].toLowerCase();
        return ch;
    }

    function shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // ============================================
    // CIPHER DEFINITIONS
    // ============================================

    const CIPHERS = {
        caesar: {
            name: "Caesar Shift",
            icon: "⚔️",
            heat: 1,
            desc: "Shift each letter by N positions in the alphabet",
            selfInverse: false,
            hasMapping: true,
            outputMode: "text",

            renderOptions(container, opts) {
                container.innerHTML = `
                    <div class="option-row">
                        <label class="form-label">Shift Amount: <strong id="shift-val">${opts.shift}</strong></label>
                        <input type="range" id="opt-shift" class="form-range" min="1" max="25" value="${opts.shift}">
                    </div>`;
                const slider = container.querySelector("#opt-shift");
                const label = container.querySelector("#shift-val");
                slider.addEventListener("input", () => {
                    opts.shift = parseInt(slider.value);
                    label.textContent = opts.shift;
                    onCipherChange();
                });
            },
            getDefaultOpts() { return { shift: 3 }; },

            encode(text, opts) {
                return text.replace(/[A-Za-z]/g, ch => shiftChar(ch, opts.shift));
            },
            decode(text, opts) {
                return text.replace(/[A-Za-z]/g, ch => shiftChar(ch, -opts.shift));
            },
            getMapping(opts) {
                return ALPHA.split("").map((ch, i) => ({
                    from: ch, to: ALPHA[(i + opts.shift) % 26]
                }));
            }
        },

        rot13: {
            name: "ROT13",
            icon: "🔄",
            heat: 1,
            desc: "Special case of Caesar — shift by 13. Encoding and decoding are identical.",
            selfInverse: true,
            hasMapping: true,
            outputMode: "text",

            renderOptions(container) {
                container.innerHTML = '<p class="option-note">ROT13 requires no configuration. Applying it twice returns the original text.</p>';
            },
            getDefaultOpts() { return {}; },

            encode(text) {
                return text.replace(/[A-Za-z]/g, ch => shiftChar(ch, 13));
            },
            decode(text) { return this.encode(text); },
            getMapping() {
                return ALPHA.split("").map((ch, i) => ({
                    from: ch, to: ALPHA[(i + 13) % 26]
                }));
            }
        },

        atbash: {
            name: "Atbash",
            icon: "🪞",
            heat: 2,
            desc: "Reverse the alphabet — A↔Z, B↔Y, C↔X. Self-inverse like ROT13.",
            selfInverse: true,
            hasMapping: true,
            outputMode: "text",

            renderOptions(container) {
                container.innerHTML = '<p class="option-note">Atbash mirrors the alphabet. No configuration needed.</p>';
            },
            getDefaultOpts() { return {}; },

            encode(text) {
                return text.replace(/[A-Za-z]/g, ch => {
                    const upper = ch.toUpperCase();
                    const rev = ALPHA[25 - (upper.charCodeAt(0) - 65)];
                    return ch === upper ? rev : rev.toLowerCase();
                });
            },
            decode(text) { return this.encode(text); },
            getMapping() {
                return ALPHA.split("").map((ch, i) => ({
                    from: ch, to: ALPHA[25 - i]
                }));
            }
        },

        vigenere: {
            name: "Vigenère",
            icon: "🗝️",
            heat: 3,
            desc: "Polyalphabetic cipher — each letter of a keyword determines a different shift.",
            selfInverse: false,
            hasMapping: false,
            outputMode: "text",

            renderOptions(container, opts) {
                container.innerHTML = `
                    <div class="option-row">
                        <label class="form-label" for="opt-keyword">Keyword</label>
                        <input type="text" id="opt-keyword" class="form-input" value="${opts.keyword}" placeholder="Enter a keyword…" maxlength="30" spellcheck="false">
                    </div>
                    <p class="option-note">Longer keywords with varied letters are harder to crack. The keyword repeats across the message.</p>`;
                const input = container.querySelector("#opt-keyword");
                input.addEventListener("input", () => {
                    opts.keyword = input.value.toUpperCase().replace(/[^A-Z]/g, "") || "A";
                    onCipherChange();
                });
            },
            getDefaultOpts() { return { keyword: "FIENDISH" }; },

            encode(text, opts) {
                const key = opts.keyword || "A";
                let ki = 0;
                return text.replace(/[A-Za-z]/g, ch => {
                    const shift = key.charCodeAt(ki % key.length) - 65;
                    ki++;
                    return shiftChar(ch, shift);
                });
            },
            decode(text, opts) {
                const key = opts.keyword || "A";
                let ki = 0;
                return text.replace(/[A-Za-z]/g, ch => {
                    const shift = key.charCodeAt(ki % key.length) - 65;
                    ki++;
                    return shiftChar(ch, -shift);
                });
            }
        },

        substitution: {
            name: "Custom Sub",
            icon: "🎲",
            heat: 3,
            desc: "Define your own letter-for-letter substitution. Randomise for a unique key.",
            selfInverse: false,
            hasMapping: true,
            outputMode: "text",

            renderOptions(container, opts) {
                if (!opts.key) opts.key = shuffleArray(ALPHA.split("")).join("");
                container.innerHTML = `
                    <div class="option-row">
                        <label class="form-label" for="opt-sub-key">Substitution Key (26 unique letters)</label>
                        <input type="text" id="opt-sub-key" class="form-input form-input--mono" value="${opts.key}" maxlength="26" spellcheck="false">
                    </div>
                    <div class="option-row">
                        <button id="opt-random-key" class="btn btn-secondary btn-sm">🎲 Randomise Key</button>
                    </div>`;
                const keyInput = container.querySelector("#opt-sub-key");
                const randomBtn = container.querySelector("#opt-random-key");

                keyInput.addEventListener("input", () => {
                    const val = keyInput.value.toUpperCase().replace(/[^A-Z]/g, "");
                    keyInput.value = val;
                    if (val.length === 26 && new Set(val).size === 26) {
                        opts.key = val;
                        onCipherChange();
                    }
                });
                randomBtn.addEventListener("click", () => {
                    opts.key = shuffleArray(ALPHA.split("")).join("");
                    keyInput.value = opts.key;
                    onCipherChange();
                });
            },
            getDefaultOpts() { return { key: null }; },

            encode(text, opts) {
                const key = opts.key || ALPHA;
                return text.replace(/[A-Za-z]/g, ch => {
                    const idx = ch.toUpperCase().charCodeAt(0) - 65;
                    const mapped = key[idx];
                    return ch === ch.toUpperCase() ? mapped : mapped.toLowerCase();
                });
            },
            decode(text, opts) {
                const key = opts.key || ALPHA;
                return text.replace(/[A-Za-z]/g, ch => {
                    const idx = key.indexOf(ch.toUpperCase());
                    if (idx === -1) return ch;
                    return ch === ch.toUpperCase() ? ALPHA[idx] : ALPHA[idx].toLowerCase();
                });
            },
            getMapping(opts) {
                const key = opts.key || ALPHA;
                return ALPHA.split("").map((ch, i) => ({ from: ch, to: key[i] }));
            }
        },

        morse: {
            name: "Morse Code",
            icon: "📡",
            heat: 2,
            desc: "The original digital encoding — dots and dashes. Words separated by /",
            selfInverse: false,
            hasMapping: true,
            outputMode: "text",

            renderOptions(container) {
                container.innerHTML = '<p class="option-note">Letters are separated by spaces. Words are separated by <code>/</code>. Supports letters A–Z and digits 0–9.</p>';
            },
            getDefaultOpts() { return {}; },

            encode(text) {
                return text.toUpperCase().split(" ").map(word =>
                    word.split("").map(ch => MORSE_MAP[ch] || ch).join(" ")
                ).join(" / ");
            },
            decode(text) {
                return text.split(" / ").map(word =>
                    word.split(" ").map(code => MORSE_REVERSE[code] || code).join("")
                ).join(" ");
            },
            getMapping() {
                return Object.entries(MORSE_MAP).map(([from, to]) => ({ from, to }));
            }
        },

        binary: {
            name: "Binary",
            icon: "💻",
            heat: 2,
            desc: "Convert each character to its 8-bit ASCII binary representation.",
            selfInverse: false,
            hasMapping: false,
            outputMode: "text",

            renderOptions(container) {
                container.innerHTML = '<p class="option-note">Each character is encoded as an 8-bit binary number. Groups are separated by spaces.</p>';
            },
            getDefaultOpts() { return {}; },

            encode(text) {
                return text.split("").map(ch =>
                    ch.charCodeAt(0).toString(2).padStart(8, "0")
                ).join(" ");
            },
            decode(text) {
                return text.trim().split(/\s+/).map(bin => {
                    const code = parseInt(bin, 2);
                    return isNaN(code) || code === 0 ? "" : String.fromCharCode(code);
                }).join("");
            }
        },

        runes: {
            name: "Elder Futhark",
            icon: "ᚱ",
            heat: 3,
            desc: "Transliterate Latin letters to ancient Elder Futhark runic script.",
            selfInverse: false,
            hasMapping: true,
            outputMode: "runes",

            renderOptions(container) {
                container.innerHTML = '<p class="option-note">Each letter is mapped to its closest Elder Futhark rune. Spaces and punctuation are preserved.</p>';
            },
            getDefaultOpts() { return {}; },

            encode(text) {
                return text.split("").map(ch => {
                    const upper = ch.toUpperCase();
                    return RUNE_MAP[upper] || ch;
                }).join("");
            },
            decode(text) {
                return text.split("").map(ch => RUNE_REVERSE[ch] || ch).join("");
            },
            getMapping() {
                return Object.entries(RUNE_MAP).map(([from, to]) => ({ from, to }));
            }
        },

        pigpen: {
            name: "Pigpen",
            icon: "🔳",
            heat: 3,
            desc: "Freemason cipher — each letter becomes a geometric symbol from the Pigpen grid.",
            selfInverse: false,
            hasMapping: true,
            outputMode: "pigpen",

            renderOptions(container) {
                container.innerHTML = '<p class="option-note">Letters are encoded as geometric shapes. The Pigpen output is visual and best suited for printing.</p>';
            },
            getDefaultOpts() { return {}; },

            encode(text) {
                return text.split("").map(ch => {
                    if (/[A-Za-z]/.test(ch)) return createPigpenSVG(ch);
                    if (ch === " ") return '<span class="pigpen-space"></span>';
                    return `<span class="pigpen-char">${ch}</span>`;
                }).join("");
            },
            decode() { return "(Pigpen is a visual cipher — decode by matching shapes to the reference grid below)"; },

            getMapping() {
                return ALPHA.split("").map(ch => ({
                    from: ch, to: createPigpenSVG(ch), isHtml: true
                }));
            }
        }
    };

    // ============================================
    // UI STATE
    // ============================================

    let activeCipherId = "caesar";
    let isDecoding = false;
    const cipherOptions = {};

    for (const [id, cipher] of Object.entries(CIPHERS)) {
        cipherOptions[id] = cipher.getDefaultOpts();
    }

    // ============================================
    // DOM REFERENCES
    // ============================================

    const tabsContainer = document.getElementById("cypher-tabs");
    const optionsPanel = document.getElementById("cypher-options");
    const inputArea = document.getElementById("cypher-input");
    const outputArea = document.getElementById("cypher-output");
    const directionBtn = document.getElementById("direction-toggle");
    const directionLabel = document.getElementById("direction-label");
    const directionArrow = document.getElementById("direction-arrow");
    const mappingGrid = document.getElementById("cypher-mapping-grid");
    const mappingSection = document.getElementById("cypher-mapping");
    const copyBtn = document.getElementById("copy-btn");
    const copyLabel = document.getElementById("copy-label");
    const clearInputBtn = document.getElementById("clear-input-btn");
    const heatDots = document.getElementById("heat-dots");
    const cipherDesc = document.getElementById("cipher-desc");

    // ============================================
    // UI CONTROLLER
    // ============================================

    function selectCipher(id) {
        activeCipherId = id;
        const cipher = CIPHERS[id];

        // Update tabs
        tabsContainer.querySelectorAll(".cypher-tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.cypher === id);
        });

        // Description & heat
        cipherDesc.textContent = cipher.desc;
        renderHeat(cipher.heat);

        // Direction handling
        if (cipher.selfInverse) {
            isDecoding = false;
            directionBtn.classList.add("self-inverse");
            directionLabel.textContent = "Encode = Decode";
            directionArrow.textContent = "⟷";
        } else {
            directionBtn.classList.remove("self-inverse");
            updateDirectionUI();
        }

        // Render cipher-specific options
        const opts = cipherOptions[id];
        if (id === "substitution" && !opts.key) {
            opts.key = shuffleArray(ALPHA.split("")).join("");
        }
        cipher.renderOptions(optionsPanel, opts);

        // Output mode styling
        outputArea.className = "output-content";
        if (cipher.outputMode === "runes") outputArea.classList.add("output-runes");
        if (cipher.outputMode === "pigpen") outputArea.classList.add("output-pigpen");

        processInput();
        renderMapping();
    }

    function renderHeat(level) {
        heatDots.innerHTML = "";
        for (let i = 0; i < 4; i++) {
            const dot = document.createElement("span");
            dot.className = i < level ? "heat-dot active" : "heat-dot";
            dot.textContent = "🌶️";
            heatDots.appendChild(dot);
        }
    }

    function updateDirectionUI() {
        if (isDecoding) {
            directionLabel.textContent = "Decode";
            directionArrow.textContent = "←";
            directionBtn.classList.add("decoding");
        } else {
            directionLabel.textContent = "Encode";
            directionArrow.textContent = "→";
            directionBtn.classList.remove("decoding");
        }
    }

    function processInput() {
        const cipher = CIPHERS[activeCipherId];
        const opts = cipherOptions[activeCipherId];
        const inputText = inputArea.value;

        if (!inputText) {
            outputArea.innerHTML = '<span class="output-placeholder">Output will appear here…</span>';
            outputArea.dataset.plainText = "";
            return;
        }

        let result;
        if (isDecoding && !cipher.selfInverse) {
            result = cipher.decode(inputText, opts);
        } else {
            result = cipher.encode(inputText, opts);
        }

        if (cipher.outputMode === "pigpen") {
            outputArea.innerHTML = result;
            outputArea.dataset.plainText = inputText;
        } else {
            outputArea.textContent = result;
            outputArea.dataset.plainText = result;
        }
    }

    function renderMapping() {
        const cipher = CIPHERS[activeCipherId];
        if (!cipher.hasMapping || !cipher.getMapping) {
            mappingSection.style.display = "none";
            return;
        }

        mappingSection.style.display = "block";
        const mapping = cipher.getMapping(cipherOptions[activeCipherId]);
        mappingGrid.innerHTML = "";

        for (const item of mapping) {
            const cell = document.createElement("div");
            cell.className = "mapping-cell";

            const fromSpan = document.createElement("span");
            fromSpan.className = "map-from";
            fromSpan.textContent = item.from;

            const arrow = document.createElement("span");
            arrow.className = "map-arrow";
            arrow.textContent = "→";

            const toSpan = document.createElement("span");
            toSpan.className = "map-to";
            if (item.isHtml) {
                toSpan.innerHTML = item.to;
            } else {
                toSpan.textContent = item.to;
            }

            cell.appendChild(fromSpan);
            cell.appendChild(arrow);
            cell.appendChild(toSpan);
            mappingGrid.appendChild(cell);
        }
    }

    function onCipherChange() {
        processInput();
        renderMapping();
    }

    // ============================================
    // EVENT BINDINGS
    // ============================================

    tabsContainer.addEventListener("click", (e) => {
        const tab = e.target.closest(".cypher-tab");
        if (tab && tab.dataset.cypher) selectCipher(tab.dataset.cypher);
    });

    inputArea.addEventListener("input", processInput);

    directionBtn.addEventListener("click", () => {
        const cipher = CIPHERS[activeCipherId];
        if (cipher.selfInverse) return;
        isDecoding = !isDecoding;
        updateDirectionUI();
        processInput();
    });

    copyBtn.addEventListener("click", () => {
        const text = outputArea.dataset.plainText || outputArea.textContent;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            copyLabel.textContent = "Copied!";
            copyBtn.classList.add("copied");
            setTimeout(() => {
                copyLabel.textContent = "Copy";
                copyBtn.classList.remove("copied");
            }, 1500);
        });
    });

    clearInputBtn.addEventListener("click", () => {
        inputArea.value = "";
        processInput();
        inputArea.focus();
    });

    // ============================================
    // INIT
    // ============================================

    selectCipher("caesar");
    inputArea.focus();
})();
