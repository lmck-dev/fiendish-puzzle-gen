/* =============================================
   Fiendish Puzzle Gen — Anagram Generator
   ============================================= */

(function () {
    "use strict";

    const RED_HERRING_LETTERS = "AEIOURSTLNBCDFGHJKMPQVWXYZ";

    let phrases = [];
    let lastPuzzle = null;

    const phraseInput  = document.getElementById("phrase-input");
    const addBtn       = document.getElementById("add-phrase-btn");
    const phraseTags   = document.getElementById("phrase-tags");
    const diffSelect   = document.getElementById("difficulty");
    const titleInput   = document.getElementById("puzzle-title");
    const hintsToggle  = document.getElementById("show-hints");
    const answersToggle= document.getElementById("show-answers");
    const generateBtn  = document.getElementById("generate-btn");
    const printBtn     = document.getElementById("print-btn");
    const clearBtn     = document.getElementById("clear-btn");
    const output       = document.getElementById("puzzle-output");
    const anagramList  = document.getElementById("anagram-list");
    const answerSection= document.getElementById("answer-key-section");
    const answerList   = document.getElementById("answer-list");
    const printTitle   = document.getElementById("print-title");

    // ---- Helpers ----

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function scrambleWord(word) {
        const letters = word.toUpperCase().split("");
        let result;
        let attempts = 0;
        do {
            result = shuffle(letters).join("");
            attempts++;
        } while (result === word.toUpperCase() && attempts < 20);
        return result;
    }

    function scramblePhrase(phrase) {
        // Pull only letters, scramble them, rebuild with spaces in same positions
        const upper = phrase.toUpperCase();
        const letters = upper.replace(/[^A-Z]/g, "").split("");
        const scrambled = (() => {
            let s;
            let attempts = 0;
            do {
                s = shuffle(letters).join("");
                attempts++;
            } while (s === letters.join("") && attempts < 20);
            return s;
        })();

        let li = 0;
        return upper.split("").map(ch => /[A-Z]/.test(ch) ? scrambled[li++] : ch).join("");
    }

    function addRedHerrings(scrambled, count) {
        const extras = Array.from({ length: count }, () =>
            RED_HERRING_LETTERS[Math.floor(Math.random() * RED_HERRING_LETTERS.length)]
        );
        return shuffle([...scrambled.split(""), ...extras]).join("");
    }

    function buildAnagram(phrase, mode) {
        const cleaned = phrase.trim();
        if (mode === "word") {
            return cleaned.split(/\s+/).map(w => scrambleWord(w)).join("  ");
        }
        const base = scramblePhrase(cleaned);
        if (mode === "hard") {
            const herringCount = Math.max(1, Math.floor(cleaned.replace(/\s/g, "").length * 0.25));
            return addRedHerrings(base.replace(/\s/g, ""), herringCount);
        }
        return base;
    }

    function wordLengthHint(phrase) {
        return phrase.trim().split(/\s+/).map(w => {
            const len = w.replace(/[^A-Za-z]/g, "").length;
            return Array(len).fill("_").join(" ");
        }).join("   ");
    }

    // ---- Phrase management ----

    function addPhrase() {
        const val = phraseInput.value.trim();
        if (!val || val.length < 2) {
            phraseInput.classList.add("shake");
            setTimeout(() => phraseInput.classList.remove("shake"), 400);
            return;
        }
        if (phrases.includes(val)) return;
        phrases.push(val);
        phraseInput.value = "";
        renderTags();
        updateGenerateBtn();
    }

    function removePhrase(p) {
        phrases = phrases.filter(x => x !== p);
        renderTags();
        updateGenerateBtn();
    }

    function renderTags() {
        phraseTags.innerHTML = "";
        phrases.forEach(p => {
            const tag = document.createElement("div");
            tag.className = "phrase-tag";
            tag.innerHTML = `<span class="phrase-tag__text">${p}</span>
                <button class="phrase-tag__remove" title="Remove">&times;</button>`;
            tag.querySelector("button").addEventListener("click", () => removePhrase(p));
            phraseTags.appendChild(tag);
        });
    }

    function updateGenerateBtn() {
        generateBtn.disabled = phrases.length === 0;
    }

    // ---- Generate ----

    function generate() {
        const mode = diffSelect.value;
        const showHints = hintsToggle.checked;
        const title = titleInput.value.trim() || "Anagram Puzzle";
        printTitle.textContent = title;

        lastPuzzle = phrases.map(p => ({
            original: p,
            scrambled: buildAnagram(p, mode),
            hint: showHints ? wordLengthHint(p) : null,
        }));

        renderPuzzle();
        output.style.display = "";
        printBtn.disabled = false;
    }

    function renderPuzzle() {
        anagramList.innerHTML = "";
        lastPuzzle.forEach((item, i) => {
            const div = document.createElement("div");
            div.className = "anagram-item fade-in";
            div.style.animationDelay = `${i * 0.06}s`;

            let hintHtml = "";
            if (item.hint) {
                hintHtml = `<div class="anagram-hint">${item.hint}</div>`;
            }

            div.innerHTML = `
                <div class="anagram-number">${i + 1}</div>
                <div class="anagram-content">
                    <div class="anagram-scrambled">${item.scrambled}</div>
                    ${hintHtml}
                    <div class="anagram-answer-line"></div>
                </div>`;
            anagramList.appendChild(div);
        });

        const showAnswers = answersToggle.checked;
        answerSection.style.display = showAnswers ? "" : "none";
        if (showAnswers) {
            answerList.innerHTML = "";
            lastPuzzle.forEach((item, i) => {
                const div = document.createElement("div");
                div.className = "answer-item";
                div.innerHTML = `<span class="answer-number">${i + 1}.</span> <span class="answer-text">${item.original}</span>`;
                answerList.appendChild(div);
            });
        }
    }

    // ---- Events ----

    addBtn.addEventListener("click", addPhrase);
    phraseInput.addEventListener("keydown", e => { if (e.key === "Enter") addPhrase(); });

    generateBtn.addEventListener("click", generate);
    printBtn.addEventListener("click", () => window.print());
    clearBtn.addEventListener("click", () => {
        phrases = [];
        lastPuzzle = null;
        renderTags();
        updateGenerateBtn();
        output.style.display = "none";
        printBtn.disabled = true;
        phraseInput.value = "";
        titleInput.value = "";
    });
})();
