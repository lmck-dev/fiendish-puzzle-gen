/* =============================================
   Fiendish Puzzle Gen — Crossword Generator
   ============================================= */

(function () {
    "use strict";

    // ---- State ----
    let clues = [];   // [{answer, clue}]
    let lastLayout = null;

    // ---- DOM ----
    const answerInput  = document.getElementById("answer-input");
    const clueInput    = document.getElementById("clue-input");
    const addBtn       = document.getElementById("add-clue-btn");
    const clueListEl   = document.getElementById("clue-list");
    const titleInput   = document.getElementById("puzzle-title");
    const cipherToggle = document.getElementById("cipher-clues");
    const answerToggle = document.getElementById("show-answer-key");
    const generateBtn  = document.getElementById("generate-btn");
    const printBtn     = document.getElementById("print-btn");
    const clearBtn     = document.getElementById("clear-btn");
    const output       = document.getElementById("puzzle-output");
    const cwGrid       = document.getElementById("cw-grid");
    const cwAnswer     = document.getElementById("cw-answer-grid");
    const cluesAcross  = document.getElementById("clues-across");
    const cluesDown    = document.getElementById("clues-down");
    const answerSection= document.getElementById("answer-key-section");
    const printTitle   = document.getElementById("print-title");
    const genWarning   = document.getElementById("gen-warning");

    // ---- ROT13 ----
    function rot13(str) {
        return str.replace(/[A-Za-z]/g, c => {
            const base = c <= 'Z' ? 65 : 97;
            return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
        });
    }

    // ---- Clue management ----
    function sanitizeAnswer(s) {
        return s.toUpperCase().replace(/[^A-Z]/g, "");
    }

    function addClue() {
        const answer = sanitizeAnswer(answerInput.value);
        const clue   = clueInput.value.trim();
        if (answer.length < 2 || !clue) {
            (answer.length < 2 ? answerInput : clueInput).classList.add("shake");
            setTimeout(() => {
                answerInput.classList.remove("shake");
                clueInput.classList.remove("shake");
            }, 400);
            return;
        }
        if (clues.some(c => c.answer === answer)) {
            answerInput.classList.add("shake");
            setTimeout(() => answerInput.classList.remove("shake"), 400);
            return;
        }
        clues.push({ answer, clue });
        answerInput.value = "";
        clueInput.value = "";
        answerInput.focus();
        renderClueList();
        updateBtn();
    }

    function removeClue(answer) {
        clues = clues.filter(c => c.answer !== answer);
        renderClueList();
        updateBtn();
    }

    function renderClueList() {
        clueListEl.innerHTML = "";
        clues.forEach(({ answer, clue }) => {
            const div = document.createElement("div");
            div.className = "clue-entry";
            div.innerHTML = `
                <div class="clue-entry__answer">${answer}</div>
                <div class="clue-entry__clue">${clue}</div>
                <button class="clue-entry__remove" title="Remove">&times;</button>`;
            div.querySelector("button").addEventListener("click", () => removeClue(answer));
            clueListEl.appendChild(div);
        });
    }

    function updateBtn() {
        generateBtn.disabled = clues.length < 3;
    }

    // ---- Crossword layout algorithm ----
    // Returns { grid, placements, rows, cols } or null

    function tryLayout(words) {
        // words: array of strings (uppercase)
        // Sort by length descending
        const sorted = [...words].sort((a, b) => b.length - a.length);

        const GRID = 25;
        const HALF = Math.floor(GRID / 2);

        // grid[r][c] = '' (black) | letter
        let grid = Array.from({ length: GRID }, () => Array(GRID).fill(""));

        // placements: [{word, r, c, dir:'across'|'down', num}]
        let placements = [];

        function canPlace(word, r, c, dir) {
            const dr = dir === "down" ? 1 : 0;
            const dc = dir === "across" ? 1 : 0;

            // Check bounds
            const endR = r + dr * (word.length - 1);
            const endC = c + dc * (word.length - 1);
            if (endR >= GRID || endC >= GRID || r < 0 || c < 0) return false;

            // Cell before start must be empty
            const preR = r - dr, preC = c - dc;
            if (preR >= 0 && preC >= 0 && grid[preR][preC] !== "") return false;
            // Cell after end must be empty
            const postR = endR + dr, postC = endC + dc;
            if (postR < GRID && postC < GRID && grid[postR][postC] !== "") return false;

            let intersections = 0;
            for (let i = 0; i < word.length; i++) {
                const gr = r + dr * i, gc = c + dc * i;
                const cell = grid[gr][gc];
                if (cell !== "") {
                    if (cell !== word[i]) return false;
                    intersections++;
                } else {
                    // Check perpendicular neighbours don't create adjacent parallel words
                    if (dir === "across") {
                        if ((gr > 0 && grid[gr-1][gc] !== "") || (gr < GRID-1 && grid[gr+1][gc] !== "")) {
                            // neighbour exists perp — would create unwanted adjacency unless it's an intersection
                            // only ok if that cell is itself part of a crossing down word
                            // simplified: reject if neighbour is filled and THIS cell is empty
                            return false;
                        }
                    } else {
                        if ((gc > 0 && grid[gr][gc-1] !== "") || (gc < GRID-1 && grid[gr][gc+1] !== "")) {
                            return false;
                        }
                    }
                }
            }
            // First word needs no intersections; subsequent words need at least one
            if (placements.length > 0 && intersections === 0) return false;
            return true;
        }

        function place(word, r, c, dir) {
            const dr = dir === "down" ? 1 : 0;
            const dc = dir === "across" ? 1 : 0;
            for (let i = 0; i < word.length; i++) {
                grid[r + dr * i][c + dc * i] = word[i];
            }
            placements.push({ word, r, c, dir });
        }

        // Place first word horizontally across center
        const first = sorted[0];
        const startC = HALF - Math.floor(first.length / 2);
        place(first, HALF, startC, "across");

        // For remaining words, try to intersect with placed words
        for (let wi = 1; wi < sorted.length; wi++) {
            const word = sorted[wi];
            let bestScore = -1;
            let bestR, bestC, bestDir;

            // Try to intersect this word against each already-placed word
            for (const placed of placements) {
                const tryDir = placed.dir === "across" ? "down" : "across";
                const dr = tryDir === "down" ? 1 : 0;
                const dc = tryDir === "across" ? 1 : 0;

                // For each letter in the new word that matches a letter in the placed word
                for (let ni = 0; ni < word.length; ni++) {
                    const pdr = placed.dir === "down" ? 1 : 0;
                    const pdc = placed.dir === "across" ? 1 : 0;

                    for (let pi = 0; pi < placed.word.length; pi++) {
                        if (placed.word[pi] !== word[ni]) continue;
                        const gr = placed.r + pdr * pi;
                        const gc = placed.c + pdc * pi;

                        // The intersection cell is (gr, gc)
                        // New word starts at (gr - dr*ni, gc - dc*ni)
                        const nr = gr - dr * ni;
                        const nc = gc - dc * ni;

                        if (canPlace(word, nr, nc, tryDir)) {
                            // Score: prefer more intersections (already handled by canPlace),
                            // prefer placement nearer center
                            const score = 100 - Math.abs(nr - HALF) - Math.abs(nc - HALF);
                            if (score > bestScore) {
                                bestScore = score;
                                bestR = nr; bestC = nc; bestDir = tryDir;
                            }
                        }
                    }
                }
            }

            if (bestScore >= 0) {
                place(word, bestR, bestC, bestDir);
            }
            // If no placement found, word is skipped (noted in warning)
        }

        if (placements.length < 2) return null;

        // Trim grid to bounding box
        let minR = GRID, maxR = 0, minC = GRID, maxC = 0;
        for (const p of placements) {
            const dr = p.dir === "down" ? 1 : 0;
            const dc = p.dir === "across" ? 1 : 0;
            minR = Math.min(minR, p.r);
            maxR = Math.max(maxR, p.r + dr * (p.word.length - 1));
            minC = Math.min(minC, p.c);
            maxC = Math.max(maxC, p.c + dc * (p.word.length - 1));
        }

        const rows = maxR - minR + 1;
        const cols = maxC - minC + 1;
        const trimmed = Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => grid[minR + r][minC + c])
        );

        // Adjust placement coordinates
        const adjusted = placements.map(p => ({
            ...p,
            r: p.r - minR,
            c: p.c - minC,
        }));

        // Assign clue numbers
        const numbered = numberCells(trimmed, rows, cols, adjusted);

        return { grid: trimmed, placements: adjusted, rows, cols, numbers: numbered };
    }

    function numberCells(grid, rows, cols, placements) {
        // Build a map of which placements start at each cell
        const startMap = {};
        for (const p of placements) {
            const key = `${p.r},${p.c},${p.dir}`;
            startMap[key] = p;
        }

        let num = 1;
        const cellNums = {};   // "r,c" -> number
        const placementNums = {};  // placement index -> number

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c] === "") continue;
                const startsAcross = startMap[`${r},${c},across`];
                const startsDown   = startMap[`${r},${c},down`];
                if (startsAcross || startsDown) {
                    cellNums[`${r},${c}`] = num;
                    if (startsAcross) placementNums[placements.indexOf(startsAcross)] = num;
                    if (startsDown)   placementNums[placements.indexOf(startsDown)]   = num;
                    num++;
                }
            }
        }

        return { cellNums, placementNums };
    }

    // ---- Render ----

    function renderGrid(container, layout, filled) {
        container.innerHTML = "";
        container.style.setProperty("--cw-cols", layout.cols);
        container.style.setProperty("--cw-rows", layout.rows);

        const { grid, rows, cols, numbers } = layout;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement("div");
                const letter = grid[r][c];

                if (letter === "") {
                    cell.className = "cw-cell cw-cell--black";
                } else {
                    cell.className = "cw-cell cw-cell--white";
                    const num = numbers.cellNums[`${r},${c}`];
                    if (num) {
                        const numEl = document.createElement("span");
                        numEl.className = "cw-cell-num";
                        numEl.textContent = num;
                        cell.appendChild(numEl);
                    }
                    if (filled) {
                        const letterEl = document.createElement("span");
                        letterEl.className = "cw-cell-letter";
                        letterEl.textContent = letter;
                        cell.appendChild(letterEl);
                    }
                }

                container.appendChild(cell);
            }
        }
    }

    function renderClues(layout, clueMap, cipherMode) {
        const acrossItems = [], downItems = [];

        layout.placements.forEach((p, i) => {
            const num = layout.numbers.placementNums[i];
            const entry = clueMap[p.word];
            const clueText = entry
                ? (cipherMode ? rot13(entry.clue) : entry.clue)
                : "???";
            const item = { num, clue: clueText, word: p.word };
            if (p.dir === "across") acrossItems.push(item);
            else downItems.push(item);
        });

        acrossItems.sort((a, b) => a.num - b.num);
        downItems.sort((a, b) => a.num - b.num);

        function renderList(el, items) {
            el.innerHTML = "";
            items.forEach(({ num, clue }) => {
                const li = document.createElement("li");
                li.setAttribute("value", num);
                li.textContent = clue;
                el.appendChild(li);
            });
        }

        renderList(cluesAcross, acrossItems);
        renderList(cluesDown, downItems);
    }

    // ---- Generate ----

    function generate() {
        genWarning.style.display = "none";

        const words = clues.map(c => c.answer);
        const clueMap = Object.fromEntries(clues.map(c => [c.answer, c]));
        const layout = tryLayout(words);

        if (!layout) {
            genWarning.textContent = "Could not place enough words to form a crossword. Try adding more words with shared letters.";
            genWarning.style.display = "";
            return;
        }

        const placed = layout.placements.map(p => p.word);
        const skipped = words.filter(w => !placed.includes(w));
        if (skipped.length > 0) {
            genWarning.textContent = `Note: ${skipped.length} word(s) couldn't be placed: ${skipped.join(", ")}`;
            genWarning.style.display = "";
        }

        lastLayout = layout;

        const title = titleInput.value.trim() || "Crossword";
        printTitle.textContent = title;

        renderGrid(cwGrid, layout, false);
        renderClues(layout, clueMap, cipherToggle.checked);

        const showAnswer = answerToggle.checked;
        answerSection.style.display = showAnswer ? "" : "none";
        if (showAnswer) renderGrid(cwAnswer, layout, true);

        output.style.display = "";
        printBtn.disabled = false;
    }

    // ---- Events ----

    addBtn.addEventListener("click", addClue);
    answerInput.addEventListener("keydown", e => { if (e.key === "Enter") { clueInput.focus(); } });
    clueInput.addEventListener("keydown", e => { if (e.key === "Enter") addClue(); });

    generateBtn.addEventListener("click", generate);
    printBtn.addEventListener("click", () => window.print());
    clearBtn.addEventListener("click", () => {
        clues = [];
        lastLayout = null;
        renderClueList();
        updateBtn();
        output.style.display = "none";
        printBtn.disabled = true;
        genWarning.style.display = "none";
        answerInput.value = "";
        clueInput.value = "";
        titleInput.value = "";
    });
})();
