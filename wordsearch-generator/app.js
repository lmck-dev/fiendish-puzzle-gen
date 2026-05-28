/* =============================================
   Word Search Generator — Application Logic
   ============================================= */

(function () {
    "use strict";

    // ---- State ----
    let words = [];

    // ---- DOM refs ----
    const wordInput = document.getElementById("word-input");
    const addWordBtn = document.getElementById("add-word-btn");
    const wordTags = document.getElementById("word-tags");
    const gridSizeSelect = document.getElementById("grid-size");
    const directionSelect = document.getElementById("direction-mode");
    const puzzleTitleInput = document.getElementById("puzzle-title");
    const generateBtn = document.getElementById("generate-btn");
    const printBtn = document.getElementById("print-btn");
    const clearBtn = document.getElementById("clear-btn");
    const puzzleOutput = document.getElementById("puzzle-output");
    const puzzleGrid = document.getElementById("puzzle-grid");
    const wordBankList = document.getElementById("word-bank-list");
    const printTitle = document.getElementById("print-title");
    const hexModeToggle = document.getElementById("hex-mode");
    const hexToggleRow = document.getElementById("hex-toggle-row");
    const inputHint = document.querySelector(".input-hint");

    // ---- Hex constants ----
    const HEX_CHARS = "0123456789ABCDEF".split("");

    // ---- Direction sets ----
    const DIRECTIONS = {
        easy: [[0, 1], [1, 0]],                                                   // → ↓
        medium: [[0, 1], [1, 0], [1, 1]],                                         // → ↓ ↘
        hard: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]] // all 8
    };

    // ---- Helpers ----
    function isHexMode() {
        return hexModeToggle.checked;
    }

    function sanitize(str) {
        const upper = str.toUpperCase();
        if (isHexMode()) {
            return upper.replace(/[^0-9A-F]/g, "");
        }
        return upper.replace(/[^A-Z0-9]/g, "");
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ---- Core: Word Search Generator ----
    function createWordSearch(wordList, size, directionMode) {
        const grid = Array.from({ length: size }, () => Array(size).fill(" "));
        const dirs = DIRECTIONS[directionMode] || DIRECTIONS.medium;

        // Build a disguise alphabet
        let alphabet;
        if (isHexMode()) {
            // In hex mode, always use full hex character set for maximum camouflage
            alphabet = [...HEX_CHARS];
        } else {
            const charSet = new Set();
            for (const w of wordList) {
                for (const ch of w) charSet.add(ch);
            }
            alphabet = [...charSet];
            // If the alphabet is too small for good disguise, supplement with common letters
            const supplementChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
            while (alphabet.length < 8) {
                const c = randomChoice(supplementChars);
                if (!alphabet.includes(c)) alphabet.push(c);
            }
        }

        // Sort words longest-first for better placement success
        const sorted = [...wordList].sort((a, b) => b.length - a.length);

        const placements = []; // store { word, r, c, dr, dc }

        for (const word of sorted) {
            let placed = false;
            let attempts = 0;
            const maxAttempts = 500;

            while (!placed && attempts < maxAttempts) {
                attempts++;
                const [dr, dc] = randomChoice(dirs);
                const r = randomInt(0, size - 1);
                const c = randomInt(0, size - 1);

                const endR = r + dr * (word.length - 1);
                const endC = c + dc * (word.length - 1);

                if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

                let fits = true;
                for (let i = 0; i < word.length; i++) {
                    const cell = grid[r + dr * i][c + dc * i];
                    if (cell !== " " && cell !== word[i]) {
                        fits = false;
                        break;
                    }
                }

                if (fits) {
                    for (let i = 0; i < word.length; i++) {
                        grid[r + dr * i][c + dc * i] = word[i];
                    }
                    placements.push({ word, r, c, dr, dc });
                    placed = true;
                }
            }

            if (!placed) {
                console.warn(`Could not place word: ${word}`);
            }
        }

        // Fill blanks with disguise characters
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (grid[r][c] === " ") {
                    grid[r][c] = randomChoice(alphabet);
                }
            }
        }

        return { grid, placements };
    }

    // ---- UI: Word list management ----
    function addWord(raw) {
        const word = sanitize(raw);
        if (!word) return;
        if (word.length < 2) return;
        if (words.includes(word)) return;

        const size = parseInt(gridSizeSelect.value, 10);
        if (word.length > size) {
            wordInput.classList.add("shake");
            setTimeout(() => wordInput.classList.remove("shake"), 400);
            return;
        }

        words.push(word);
        renderTags();
        updateButtons();
        wordInput.value = "";
        wordInput.focus();
    }

    function removeWord(word) {
        words = words.filter(w => w !== word);
        renderTags();
        updateButtons();
    }

    function renderTags() {
        wordTags.innerHTML = "";
        const hex = isHexMode();
        for (const word of words) {
            const tag = document.createElement("span");
            tag.className = hex ? "word-tag hex-tag" : "word-tag";
            tag.innerHTML = `${word}<button title="Remove" aria-label="Remove ${word}">&times;</button>`;
            tag.querySelector("button").addEventListener("click", () => removeWord(word));
            wordTags.appendChild(tag);
        }
    }

    function updateButtons() {
        const hasWords = words.length > 0;
        generateBtn.disabled = !hasWords;
        clearBtn.disabled = !hasWords && puzzleOutput.style.display === "none";
    }

    // ---- UI: Render puzzle grid ----
    function renderPuzzle(grid) {
        puzzleGrid.innerHTML = "";
        for (const row of grid) {
            const tr = document.createElement("tr");
            for (const cell of row) {
                const td = document.createElement("td");
                td.textContent = cell;
                tr.appendChild(td);
            }
            puzzleGrid.appendChild(tr);
        }
    }

    function renderWordBank(wordList) {
        wordBankList.innerHTML = "";
        const sorted = [...wordList].sort();
        for (const word of sorted) {
            const li = document.createElement("li");
            li.textContent = word;
            wordBankList.appendChild(li);
        }
    }

    // ---- Actions ----
    function generate() {
        if (words.length === 0) return;

        const size = parseInt(gridSizeSelect.value, 10);
        const mode = directionSelect.value;
        const title = puzzleTitleInput.value.trim() || "Word Search";

        const { grid } = createWordSearch([...words], size, mode);

        renderPuzzle(grid);
        renderWordBank(words);
        printTitle.textContent = title;

        puzzleOutput.style.display = "block";
        printBtn.disabled = false;
        clearBtn.disabled = false;

        // Scroll puzzle into view smoothly
        puzzleOutput.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function clearAll() {
        words = [];
        renderTags();
        puzzleOutput.style.display = "none";
        puzzleGrid.innerHTML = "";
        wordBankList.innerHTML = "";
        printBtn.disabled = true;
        updateButtons();
        wordInput.focus();
    }

    // ---- Event listeners ----
    addWordBtn.addEventListener("click", () => addWord(wordInput.value));

    wordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addWord(wordInput.value);
        }
    });

    generateBtn.addEventListener("click", generate);

    printBtn.addEventListener("click", () => window.print());

    clearBtn.addEventListener("click", clearAll);

    // Re-validate word length when grid size changes
    gridSizeSelect.addEventListener("change", () => {
        const size = parseInt(gridSizeSelect.value, 10);
        words = words.filter(w => w.length <= size);
        renderTags();
        updateButtons();
    });

    // ---- Hex mode toggle ----
    function updateHexUI() {
        const hex = isHexMode();
        hexToggleRow.classList.toggle("active", hex);

        if (hex) {
            wordInput.placeholder = "Hex string, e.g. DEADBEEF…";
            inputHint.textContent = "Hex characters only (0-9, A-F) · Max 20 characters";
            // Strip non-hex chars from existing words
            words = words.map(w => w.replace(/[^0-9A-F]/g, "")).filter(w => w.length >= 2);
        } else {
            wordInput.placeholder = "Type a word and press Enter…";
            inputHint.textContent = "Letters and numbers only · Max 20 characters per word";
        }

        // Deduplicate after stripping
        words = [...new Set(words)];
        renderTags();
        updateButtons();
        wordInput.focus();
    }

    hexModeToggle.addEventListener("change", updateHexUI);

    // ---- Init ----
    updateButtons();
    wordInput.focus();
})();
