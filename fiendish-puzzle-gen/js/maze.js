/* =============================================
   Fiendish Puzzle Gen — Maze Generator
   Uses recursive backtracking (DFS) to carve a perfect maze.
   The solution path is computed via BFS, then message letters
   are distributed evenly across solution path cells.
   ============================================= */

(function () {
    "use strict";

    const msgInput     = document.getElementById("hidden-message");
    const sizeSelect   = document.getElementById("maze-size");
    const titleInput   = document.getElementById("puzzle-title");
    const showPath     = document.getElementById("show-path");
    const showLetters  = document.getElementById("show-letters");
    const generateBtn  = document.getElementById("generate-btn");
    const printBtn     = document.getElementById("print-btn");
    const clearBtn     = document.getElementById("clear-btn");
    const output       = document.getElementById("puzzle-output");
    const canvas       = document.getElementById("maze-canvas");
    const answerCanvas = document.getElementById("answer-canvas");
    const answerSection= document.getElementById("answer-section");
    const printTitle   = document.getElementById("print-title");
    const mzMessage    = document.getElementById("mz-message");

    // ---- Input validation ----

    function sanitize(s) {
        return s.toUpperCase().replace(/[^A-Z]/g, "");
    }

    msgInput.addEventListener("input", () => {
        generateBtn.disabled = sanitize(msgInput.value).length === 0;
    });

    // ---- Maze generation (recursive backtracker) ----
    // Each cell has walls: N, S, E, W (bits 1,2,4,8)
    // 0 = all walls, wall removed = passage open

    const N = 1, S = 2, E = 4, W = 8;
    const OPPOSITE = { [N]: S, [S]: N, [E]: W, [W]: E };
    const DIR_DELTA = {
        [N]: { dr: -1, dc: 0 },
        [S]: { dr:  1, dc: 0 },
        [E]: { dr:  0, dc: 1 },
        [W]: { dr:  0, dc: -1 },
    };

    function generateMaze(rows, cols) {
        const cells = Array.from({ length: rows }, () => Array(cols).fill(0));
        const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

        function shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        function carve(r, c) {
            visited[r][c] = true;
            const dirs = shuffle([N, S, E, W]);
            for (const dir of dirs) {
                const { dr, dc } = DIR_DELTA[dir];
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                if (visited[nr][nc]) continue;
                cells[r][c] |= dir;
                cells[nr][nc] |= OPPOSITE[dir];
                carve(nr, nc);
            }
        }

        carve(0, 0);
        return cells;
    }

    // ---- BFS to find shortest path ----

    function findPath(cells, rows, cols) {
        const dist = Array.from({ length: rows }, () => Array(cols).fill(-1));
        const prev = Array.from({ length: rows }, () => Array(cols).fill(null));
        const queue = [[0, 0]];
        dist[0][0] = 0;

        while (queue.length) {
            const [r, c] = queue.shift();
            for (const dir of [N, S, E, W]) {
                if (!(cells[r][c] & dir)) continue;
                const { dr, dc } = DIR_DELTA[dir];
                const nr = r + dr, nc = c + dc;
                if (dist[nr][nc] !== -1) continue;
                dist[nr][nc] = dist[r][c] + 1;
                prev[nr][nc] = [r, c];
                queue.push([nr, nc]);
            }
        }

        // Reconstruct path from end to start
        const path = [];
        let cur = [rows - 1, cols - 1];
        while (cur) {
            path.unshift(cur);
            cur = prev[cur[0]][cur[1]];
        }
        return path;
    }

    // ---- Assign letters to path ----

    function assignLetters(path, message) {
        // Distribute message letters evenly across path cells (skip start/end)
        const inner = path.slice(1, -1);
        if (inner.length === 0 || message.length === 0) return {};

        const letterMap = {};
        const step = inner.length / message.length;

        for (let i = 0; i < message.length; i++) {
            const idx = Math.round(i * step + step / 2 - 0.5);
            const safeIdx = Math.min(idx, inner.length - 1);
            const [r, c] = inner[safeIdx];
            letterMap[`${r},${c}`] = message[i];
        }
        return letterMap;
    }

    // ---- Draw ----

    const CELL = 28;      // px per cell
    const WALL = 2;       // wall thickness
    const PADDING = 4;    // canvas padding

    function draw(ctx, cells, rows, cols, path, letterMap, drawPath, drawLetters) {
        const W_canvas = cols * CELL + PADDING * 2;
        const H_canvas = rows * CELL + PADDING * 2;
        ctx.canvas.width  = W_canvas;
        ctx.canvas.height = H_canvas;

        const isDark = true;
        ctx.fillStyle = isDark ? "#0b0b14" : "#fff";
        ctx.fillRect(0, 0, W_canvas, H_canvas);

        const pathSet = new Set(path.map(([r, c]) => `${r},${c}`));

        // Draw path background if requested
        if (drawPath) {
            ctx.fillStyle = "rgba(230,57,70,0.12)";
            for (const [r, c] of path) {
                ctx.fillRect(
                    PADDING + c * CELL + WALL,
                    PADDING + r * CELL + WALL,
                    CELL - WALL, CELL - WALL
                );
            }
        }

        // Draw start / end markers
        const markers = [
            { r: 0,        c: 0,        color: "#10b981" },
            { r: rows - 1, c: cols - 1, color: "#e63946" },
        ];
        for (const { r, c, color } of markers) {
            ctx.fillStyle = color + "33";
            ctx.fillRect(PADDING + c * CELL + WALL, PADDING + r * CELL + WALL, CELL - WALL, CELL - WALL);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(
                PADDING + c * CELL + CELL / 2,
                PADDING + r * CELL + CELL / 2,
                4, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // Draw letters on path cells
        if (drawLetters) {
            ctx.font = `bold ${Math.max(8, CELL * 0.42)}px 'Space Mono', monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            for (const [key, letter] of Object.entries(letterMap)) {
                const [r, c] = key.split(",").map(Number);
                ctx.fillStyle = drawPath ? "#f59e0b" : "rgba(230,57,70,0.6)";
                ctx.fillText(
                    letter,
                    PADDING + c * CELL + CELL / 2,
                    PADDING + r * CELL + CELL / 2
                );
            }
        }

        // Draw walls
        ctx.strokeStyle = "#ededf0";
        ctx.lineWidth = WALL;
        ctx.lineCap = "square";

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = PADDING + c * CELL;
                const y = PADDING + r * CELL;
                const cell = cells[r][c];

                ctx.beginPath();
                // North wall
                if (!(cell & N)) {
                    ctx.moveTo(x, y); ctx.lineTo(x + CELL, y);
                }
                // West wall
                if (!(cell & W)) {
                    ctx.moveTo(x, y); ctx.lineTo(x, y + CELL);
                }
                // South wall (only on last row)
                if (r === rows - 1 && !(cell & S)) {
                    ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL);
                }
                // East wall (only on last col)
                if (c === cols - 1 && !(cell & E)) {
                    ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL);
                }
                ctx.stroke();
            }
        }

        // Border
        ctx.strokeStyle = "#ededf0";
        ctx.lineWidth = WALL;
        ctx.strokeRect(PADDING, PADDING, cols * CELL, rows * CELL);

        // Label S / E
        ctx.font = "bold 10px 'Space Grotesk', sans-serif";
        ctx.textAlign = "left";
        ctx.fillStyle = "#10b981";
        ctx.fillText("S", PADDING + 3, PADDING - 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#e63946";
        ctx.fillText("E", PADDING + cols * CELL - 2, PADDING + rows * CELL + 11);
    }

    // ---- Generate ----

    let lastData = null;

    function generate() {
        const message = sanitize(msgInput.value);
        if (!message) return;

        const size  = parseInt(sizeSelect.value, 10);
        const title = titleInput.value.trim() || "Maze";
        printTitle.textContent = title;

        const cells = generateMaze(size, size);
        const path  = findPath(cells, size, size);
        const letterMap = assignLetters(path, message);

        lastData = { cells, path, letterMap, rows: size, cols: size, message };

        const puzzleCtx = canvas.getContext("2d");
        draw(puzzleCtx, cells, size, size, path, letterMap, false, true);

        const showSolution = showPath.checked;
        answerSection.style.display = showSolution ? "" : "none";
        if (showSolution) {
            const ansCtx = answerCanvas.getContext("2d");
            draw(ansCtx, cells, size, size, path, letterMap, true, true);
            mzMessage.textContent = "Hidden message: " + message;
        }

        output.style.display = "";
        printBtn.disabled = false;
    }

    // ---- Events ----

    generateBtn.addEventListener("click", generate);
    printBtn.addEventListener("click", () => window.print());
    clearBtn.addEventListener("click", () => {
        msgInput.value = "";
        titleInput.value = "";
        lastData = null;
        generateBtn.disabled = true;
        printBtn.disabled = true;
        output.style.display = "none";
    });

    showPath.addEventListener("change", () => {
        if (!lastData) return;
        const { cells, path, letterMap, rows, cols, message } = lastData;
        answerSection.style.display = showPath.checked ? "" : "none";
        if (showPath.checked) {
            const ansCtx = answerCanvas.getContext("2d");
            draw(ansCtx, cells, rows, cols, path, letterMap, true, true);
            mzMessage.textContent = "Hidden message: " + message;
        }
    });

    showLetters.addEventListener("change", () => {
        if (!lastData) return;
        const { cells, path, letterMap, rows, cols } = lastData;
        const puzzleCtx = canvas.getContext("2d");
        draw(puzzleCtx, cells, rows, cols, path, letterMap, false, showLetters.checked);
    });
})();
