/* =============================================
   Fiendish Puzzle Gen — Puzzle Chainer
   Chains ciphers and scrambles: the output of
   each step becomes the input of the next.
   The solver receives the final output and must
   work backwards through the chain.
   ============================================= */

(function () {
    "use strict";

    // ============================================
    // CIPHER ENGINE
    // ============================================

    const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    function shiftChar(ch, n) {
        const isLower = ch >= "a" && ch <= "z";
        const base = isLower ? 97 : 65;
        return String.fromCharCode(((ch.charCodeAt(0) - base + n + 2600) % 26) + base);
    }

    function caesarEncode(text, shift) {
        return text.replace(/[A-Za-z]/g, ch => shiftChar(ch, shift));
    }

    function atbashEncode(text) {
        return text.replace(/[A-Za-z]/g, ch => {
            const base = ch <= "Z" ? 65 : 97;
            return String.fromCharCode(base + 25 - (ch.charCodeAt(0) - base));
        });
    }

    function vigenereEncode(text, keyword) {
        const key = keyword.toUpperCase().replace(/[^A-Z]/g, "") || "KEY";
        let ki = 0;
        return text.replace(/[A-Za-z]/g, ch => {
            const result = shiftChar(ch, key.charCodeAt(ki % key.length) - 65);
            ki++;
            return result;
        });
    }

    function reverseEncode(text) {
        return text.split("").reverse().join("");
    }

    function shuffleArr(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function scrambleWord(word) {
        const letters = word.toUpperCase().split("");
        if (letters.length <= 1) return word.toUpperCase();
        let result, attempts = 0;
        do {
            result = shuffleArr(letters).join("");
            attempts++;
        } while (result === word.toUpperCase() && attempts < 30);
        return result;
    }

    function anagramEncode(text, mode) {
        if (mode === "word") {
            return text.split(/\s+/).map(w => {
                const clean = w.replace(/[^A-Za-z]/g, "");
                if (!clean) return w;
                return scrambleWord(clean);
            }).join(" ");
        }
        // phrase: scramble all letters, preserve spaces
        const upper = text.toUpperCase();
        const letters = upper.replace(/[^A-Z]/g, "").split("");
        const scrambled = (() => {
            let s, attempts = 0;
            do {
                s = shuffleArr(letters).join("");
                attempts++;
            } while (s === letters.join("") && attempts < 30);
            return s;
        })();
        let li = 0;
        return upper.split("").map(ch => /[A-Z]/.test(ch) ? scrambled[li++] : ch).join("");
    }

    // ============================================
    // STEP TYPE DEFINITIONS
    // ============================================

    const STEP_TYPES = {

        caesar: {
            name: "Caesar Cipher",
            desc: "Shift each letter by N positions in the alphabet",
            defaultOpts: () => ({ shift: 3 }),

            encode(text, opts) { return caesarEncode(text, opts.shift); },

            renderOpts(container, opts, onChange) {
                container.innerHTML = `<div class="step-opt-row">
                    <label class="step-opt-label">Shift: <strong class="opt-val">${opts.shift}</strong></label>
                    <input type="range" class="form-range opt-shift" min="1" max="25" value="${opts.shift}">
                </div>`;
                const slider = container.querySelector(".opt-shift");
                const label  = container.querySelector(".opt-val");
                slider.addEventListener("input", () => {
                    opts.shift = parseInt(slider.value);
                    label.textContent = opts.shift;
                    onChange();
                });
            },

            solverInstruction(opts) {
                return `Decode using a <strong>Caesar cipher</strong>. Shift each letter <em>backward</em> by <strong>${opts.shift}</strong> position${opts.shift !== 1 ? "s" : ""} in the alphabet.`;
            },
            answerKeyLabel(opts) { return `Caesar +${opts.shift}`; }
        },

        rot13: {
            name: "ROT13",
            desc: "Shift by 13 — self-inverse, no configuration needed",
            defaultOpts: () => ({}),

            encode(text) { return caesarEncode(text, 13); },

            renderOpts(container) {
                container.innerHTML = `<p class="step-opt-note">No configuration needed. Applying ROT13 twice returns the original text.</p>`;
            },

            solverInstruction() {
                return `Apply <strong>ROT13</strong>. Replace each letter with the one 13 places away (A↔N, B↔O, C↔P…). It is its own inverse — just apply it once.`;
            },
            answerKeyLabel() { return "ROT13"; }
        },

        atbash: {
            name: "Atbash",
            desc: "Mirror the alphabet — A↔Z, B↔Y, C↔X…",
            defaultOpts: () => ({}),

            encode(text) { return atbashEncode(text); },

            renderOpts(container) {
                container.innerHTML = `<p class="step-opt-note">No configuration needed. Atbash is self-inverse — applying it again restores the original.</p>`;
            },

            solverInstruction() {
                return `Apply <strong>Atbash</strong>. Mirror each letter in the alphabet: A↔Z, B↔Y, C↔X, and so on.`;
            },
            answerKeyLabel() { return "Atbash"; }
        },

        vigenere: {
            name: "Vigenère",
            desc: "Polyalphabetic shift driven by a keyword",
            defaultOpts: () => ({ keyword: "KEY" }),

            encode(text, opts) { return vigenereEncode(text, opts.keyword || "KEY"); },

            renderOpts(container, opts, onChange) {
                container.innerHTML = `<div class="step-opt-row">
                    <label class="step-opt-label form-label">Keyword</label>
                    <input type="text" class="form-input opt-keyword" value="${opts.keyword}" placeholder="KEY" maxlength="20" style="text-transform:uppercase">
                </div>`;
                container.querySelector(".opt-keyword").addEventListener("input", e => {
                    opts.keyword = e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase() || "KEY";
                    e.target.value = opts.keyword;
                    onChange();
                });
            },

            solverInstruction(opts) {
                return `Decode using a <strong>Vigenère cipher</strong> with keyword: <strong class="mono">${escHtml(opts.keyword)}</strong>. For each letter, shift it <em>backward</em> by the value of the corresponding keyword letter (A=0, B=1…). The keyword repeats cyclically.`;
            },
            answerKeyLabel(opts) { return `Vigenère (${opts.keyword})`; }
        },

        reverse: {
            name: "Reverse",
            desc: "Read the entire string backwards",
            defaultOpts: () => ({}),

            encode(text) { return reverseEncode(text); },

            renderOpts(container) {
                container.innerHTML = `<p class="step-opt-note">No configuration needed. Reverse the string to decode.</p>`;
            },

            solverInstruction() {
                return `<strong>Reverse</strong> the entire string — read it backwards, character by character.`;
            },
            answerKeyLabel() { return "Reverse"; }
        },

        anagram: {
            name: "Anagram",
            desc: "Scramble the letters of the text",
            defaultOpts: () => ({ mode: "word" }),

            encode(text, opts) { return anagramEncode(text, opts.mode); },

            renderOpts(container, opts, onChange) {
                container.innerHTML = `<div class="step-opt-row">
                    <label class="step-opt-label form-label">Scramble Mode</label>
                    <select class="form-select opt-mode">
                        <option value="word"   ${opts.mode === "word"   ? "selected" : ""}>Word-by-Word</option>
                        <option value="phrase" ${opts.mode === "phrase" ? "selected" : ""}>Full Phrase</option>
                    </select>
                </div>`;
                container.querySelector(".opt-mode").addEventListener("change", e => {
                    opts.mode = e.target.value;
                    onChange();
                });
            },

            solverInstruction(opts) {
                return opts.mode === "word"
                    ? `<strong>Anagram</strong> — unscramble each word independently. The word boundaries are preserved.`
                    : `<strong>Anagram</strong> — all the letters together form a phrase. Unscramble them, preserving the word boundaries shown.`;
            },
            answerKeyLabel(opts) {
                return `Anagram (${opts.mode === "word" ? "word-by-word" : "full phrase"})`;
            }
        }
    };

    // ============================================
    // STATE
    // ============================================

    let steps = [];
    let generated = null;

    // ============================================
    // DOM REFS
    // ============================================

    const titleInput    = document.getElementById("chain-title");
    const inputTextarea = document.getElementById("chain-input");
    const stepList      = document.getElementById("step-list");
    const stepCountBadge= document.getElementById("step-count");
    const addStepBtn    = document.getElementById("add-step-btn");
    const generateBtn   = document.getElementById("generate-btn");
    const printBtn      = document.getElementById("print-btn");
    const exportBtn     = document.getElementById("export-btn");
    const clearBtn      = document.getElementById("clear-btn");
    const outputSection = document.getElementById("chain-output");
    const chainPreview  = document.getElementById("chain-preview");
    const printOutput   = document.getElementById("print-output");

    // ============================================
    // STEP BUILDER UI
    // ============================================

    function renderStepList() {
        stepList.innerHTML = "";
        const count = steps.length;
        stepCountBadge.textContent = `${count} step${count !== 1 ? "s" : ""}`;

        if (count === 0) {
            stepList.innerHTML = `<p class="step-empty">No steps yet. Add a step to build your encoding chain.</p>`;
            return;
        }

        steps.forEach((step, i) => {
            const def = STEP_TYPES[step.type];
            const item = document.createElement("div");
            item.className = "step-item fade-in";
            item.style.animationDelay = `${i * 0.04}s`;

            const typeOpts = Object.entries(STEP_TYPES)
                .map(([k, d]) => `<option value="${k}" ${k === step.type ? "selected" : ""}>${d.name}</option>`)
                .join("");

            item.innerHTML = `
                <div class="step-header">
                    <div class="step-badge">${i + 1}</div>
                    <select class="step-type-select form-select" data-index="${i}">${typeOpts}</select>
                    <button class="step-remove-btn" data-index="${i}" title="Remove step" aria-label="Remove step ${i + 1}">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div class="step-desc">${def.desc}</div>
                <div class="step-opts" data-index="${i}"></div>
            `;

            // Connector arrow (between steps)
            if (i < steps.length - 1) {
                const conn = document.createElement("div");
                conn.className = "step-connector";
                conn.innerHTML = `<div class="step-conn-line"></div><div class="step-conn-arrow">↓</div>`;
                item.appendChild(conn);
            }

            stepList.appendChild(item);

            // Render step-specific options
            def.renderOpts(item.querySelector(".step-opts"), step.opts, () => {
                clearGenerated();
            });
        });

        // Wire type selects
        stepList.querySelectorAll(".step-type-select").forEach(sel => {
            sel.addEventListener("change", e => {
                const idx = parseInt(e.target.dataset.index);
                const newType = e.target.value;
                steps[idx] = { type: newType, opts: STEP_TYPES[newType].defaultOpts() };
                renderStepList();
                clearGenerated();
            });
        });

        // Wire remove buttons
        stepList.querySelectorAll(".step-remove-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.index);
                steps.splice(idx, 1);
                renderStepList();
                clearGenerated();
                updateGenerateBtn();
            });
        });
    }

    function clearGenerated() {
        generated = null;
        outputSection.style.display = "none";
        printBtn.disabled = true;
        exportBtn.disabled = true;
    }

    function updateGenerateBtn() {
        generateBtn.disabled = steps.length === 0 || !inputTextarea.value.trim();
    }

    // ============================================
    // GENERATE
    // ============================================

    function generate() {
        const rawInput = inputTextarea.value.trim();
        const title = titleInput.value.trim() || "Puzzle Chain";

        let current = rawInput;
        const chain = [];

        for (const step of steps) {
            const def = STEP_TYPES[step.type];
            const input = current;
            const output = def.encode(input, step.opts);
            chain.push({ type: step.type, opts: { ...step.opts }, input, output });
            current = output;
        }

        generated = { title, inputText: rawInput, chain, finalOutput: current };

        renderPreview();
        renderPrintOutput();
        outputSection.style.display = "";
        printBtn.disabled = false;
        exportBtn.disabled = false;
    }

    // ============================================
    // ON-SCREEN PREVIEW
    // ============================================

    function renderPreview() {
        chainPreview.innerHTML = "";

        // Input node
        const inputNode = document.createElement("div");
        inputNode.className = "chain-node chain-node--input";
        inputNode.innerHTML = `
            <div class="chain-node-label">ORIGINAL TEXT</div>
            <div class="chain-node-text">${escHtml(generated.inputText)}</div>
        `;
        chainPreview.appendChild(inputNode);

        generated.chain.forEach((step, i) => {
            const def = STEP_TYPES[step.type];
            const isFinal = i === generated.chain.length - 1;

            // Arrow + step label
            const arrow = document.createElement("div");
            arrow.className = "chain-arrow";
            arrow.innerHTML = `
                <div class="chain-arrow-inner">
                    <div class="chain-arrow-dash"></div>
                    <div class="chain-arrow-head">↓</div>
                </div>
                <div class="chain-arrow-label">${escHtml(def.name)}${stepSummary(step)}</div>
            `;
            chainPreview.appendChild(arrow);

            // Output node
            const node = document.createElement("div");
            node.className = `chain-node${isFinal ? " chain-node--final" : ""}`;
            node.innerHTML = `
                <div class="chain-node-label">${isFinal ? "SOLVER STARTS HERE" : `AFTER STEP ${i + 1}`}</div>
                <div class="chain-node-text">${escHtml(step.output)}</div>
                ${isFinal ? `<button class="chain-copy-btn" title="Copy to clipboard">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="4" y="4" width="8" height="9" rx="1" stroke="currentColor" stroke-width="1.3"/>
                        <path d="M2 10V2h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Copy
                </button>` : ""}
            `;
            chainPreview.appendChild(node);
        });

        // Wire copy button
        const copyBtn = chainPreview.querySelector(".chain-copy-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(generated.finalOutput).then(() => {
                    copyBtn.textContent = "Copied!";
                    setTimeout(() => {
                        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <rect x="4" y="4" width="8" height="9" rx="1" stroke="currentColor" stroke-width="1.3"/>
                            <path d="M2 10V2h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg> Copy`;
                    }, 1500);
                });
            });
        }
    }

    function stepSummary(step) {
        switch (step.type) {
            case "caesar":   return ` (+${step.opts.shift})`;
            case "vigenere": return ` (${escHtml(step.opts.keyword)})`;
            case "anagram":  return ` (${step.opts.mode})`;
            default: return "";
        }
    }

    // ============================================
    // PRINT OUTPUT
    // ============================================

    function renderPrintOutput() {
        const { title, chain, inputText, finalOutput } = generated;
        const reversed = [...chain].reverse();
        let html = "";

        // ---- Solver worksheet ----
        html += `<div class="print-sheet">`;
        html += `<div class="print-header"><h2 id="print-title" class="print-title">${escHtml(title)}</h2></div>`;

        html += `<div class="print-start-block">
            <div class="print-start-label">START WITH THIS</div>
            <div class="print-start-text">${escHtml(finalOutput)}</div>
        </div>`;

        reversed.forEach((step, i) => {
            const def = STEP_TYPES[step.type];
            const stepNum = i + 1;
            const isLast = i === reversed.length - 1;
            html += `<div class="print-step">
                <div class="print-step-hd">
                    <div class="print-step-num">${stepNum}</div>
                    <div class="print-step-name">${def.name}</div>
                </div>
                <div class="print-step-instr">${def.solverInstruction(step.opts)}</div>
                <div class="print-answer-row">
                    <span class="print-answer-label">Answer:</span>
                    <span class="print-answer-line"></span>
                </div>
                ${isLast ? `<div class="print-final-msg">That's your final answer!</div>` : ""}
            </div>`;
        });

        html += `</div>`; // end .print-sheet

        // ---- Answer key (page break) ----
        html += `<div class="print-answer-key">
            <div class="print-ak-title">Answer Key — ${escHtml(title)}</div>
            <div class="print-ak-row">
                <span class="print-ak-lbl">Original text:</span>
                <span class="print-ak-val">${escHtml(inputText)}</span>
            </div>`;

        chain.forEach(step => {
            const def = STEP_TYPES[step.type];
            html += `<div class="print-ak-row">
                <span class="print-ak-lbl">→ ${def.answerKeyLabel(step.opts)}:</span>
                <span class="print-ak-val">${escHtml(step.output)}</span>
            </div>`;
        });

        html += `<div class="print-ak-row print-ak-row--final">
                <span class="print-ak-lbl">Solver starts with:</span>
                <span class="print-ak-val">${escHtml(finalOutput)}</span>
            </div>
        </div>`;

        printOutput.innerHTML = html;
    }

    // ============================================
    // EXPORT (puzzle exchange format for Code Talker)
    // ============================================

    function exportPuzzle() {
        const spec = {
            fpg: "1.0",
            type: "chain",
            title: generated.title,
            encoded: generated.finalOutput,
            steps: generated.chain.map(step => {
                const s = { cipher: step.type };
                if (step.type === "caesar")   s.shift = step.opts.shift;
                if (step.type === "vigenere") s.keyword = step.opts.keyword;
                if (step.type === "anagram")  s.mode = step.opts.mode;
                return s;
            })
        };

        const json = JSON.stringify(spec, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = generated.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".fpg.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============================================
    // UTILITIES
    // ============================================

    function escHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // ============================================
    // EVENT WIRING
    // ============================================

    addStepBtn.addEventListener("click", () => {
        steps.push({ type: "caesar", opts: STEP_TYPES.caesar.defaultOpts() });
        renderStepList();
        updateGenerateBtn();
    });

    inputTextarea.addEventListener("input", () => {
        updateGenerateBtn();
        clearGenerated();
    });

    generateBtn.addEventListener("click", generate);
    printBtn.addEventListener("click", () => window.print());
    exportBtn.addEventListener("click", exportPuzzle);

    clearBtn.addEventListener("click", () => {
        steps = [];
        generated = null;
        inputTextarea.value = "";
        titleInput.value = "";
        renderStepList();
        updateGenerateBtn();
        outputSection.style.display = "none";
        printBtn.disabled = true;
        exportBtn.disabled = true;
    });

    // Init
    renderStepList();
    updateGenerateBtn();

})();
