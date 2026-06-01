/* =============================================
   Fiendish Puzzle Gen — Language Translator Engine
   Three-layer translation pipeline:
     L0 — exact dictionary match
     L1 — lemmatized form match (FPG_Lemmatizer)
     L2 — semantic synonym expansion (FPG_Synonyms)
     L3 — Gemini grammar reordering (optional, API key required)
   ============================================= */

(function () {
    "use strict";

    // ============================================
    // CONSTANTS
    // ============================================

    const STORAGE_KEY   = "fpg_custom_languages";
    const GEMINI_KEY    = "fpg_gemini_key";
    const GEMINI_URL    = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    // Grammar profiles — used by Layer 3 to instruct Gemini
    const GRAMMAR = {
        klingon:  { order: "OVS",  note: "Klingon: Object–Verb–Subject. Verbs take prefixes encoding subject/object." },
        sindarin: { order: "VSO",  note: "Sindarin: Verb–Subject–Object. Adjectives follow nouns." },
        dothraki: { order: "SVO",  note: "Dothraki: Subject–Verb–Object, similar to English. Adjectives follow nouns." },
        dovahzul: { order: "SVO",  note: "Dovahzul (Dragon Language): Subject–Verb–Object." },
        valyrian: { order: "SOV",  note: "High Valyrian: flexible, tends toward Subject–Object–Verb." },
    };

    // ============================================
    // STATE
    // ============================================

    let appLanguages    = {};
    let activeLanguageId = "klingon";
    let isReversed      = false;
    let reverseDict     = {};

    // ============================================
    // DOM
    // ============================================

    const langSelector  = document.getElementById("lang-selector");
    const inputArea     = document.getElementById("trans-input");
    const outputArea    = document.getElementById("trans-output");
    const clearBtn      = document.getElementById("clear-trans-btn");
    const copyBtn       = document.getElementById("copy-trans-btn");
    const copyLabel     = document.getElementById("copy-trans-label");
    const dirToggle     = document.getElementById("trans-direction");
    const dirLabel      = document.getElementById("trans-dir-label");
    const langTitle     = document.getElementById("lang-title");
    const langNative    = document.getElementById("lang-native");
    const langDesc      = document.getElementById("lang-desc");
    const langUniverse  = document.getElementById("lang-universe");
    const dictSearch    = document.getElementById("dict-search");
    const dictList      = document.getElementById("dict-list");
    const dictCount     = document.getElementById("dict-count");
    const statsTotal    = document.getElementById("stats-total");
    const statsTranslated = document.getElementById("stats-translated");
    const statsMissing  = document.getElementById("stats-missing");
    const statsLemma    = document.getElementById("stats-lemma");
    const statsSynonym  = document.getElementById("stats-synonym");

    // Manager
    const btnToggleWord   = document.getElementById("btn-toggle-word");
    const btnToggleLang   = document.getElementById("btn-toggle-lang");
    const btnToggleImport = document.getElementById("btn-toggle-import");
    const btnExport       = document.getElementById("btn-export");
    const panelAddWord    = document.getElementById("panel-add-word");
    const panelAddLang    = document.getElementById("panel-add-lang");
    const panelImport     = document.getElementById("panel-import");
    const btnSaveWord     = document.getElementById("btn-save-word");
    const inputWordEng    = document.getElementById("input-word-eng");
    const inputWordTrans  = document.getElementById("input-word-trans");
    const btnSaveLang     = document.getElementById("btn-save-lang");
    const inputLangId     = document.getElementById("input-lang-id");
    const inputLangName   = document.getElementById("input-lang-name");
    const btnSaveImport   = document.getElementById("btn-save-import");
    const inputImportData = document.getElementById("input-import-data");

    // AI layer
    const aiKeyInput    = document.getElementById("ai-key-input");
    const aiSaveBtn     = document.getElementById("ai-save-btn");
    const aiClearBtn    = document.getElementById("ai-clear-btn");
    const aiStatus      = document.getElementById("ai-status");
    const aiGrammarBtn  = document.getElementById("ai-grammar-btn");
    const aiGrammarOut  = document.getElementById("ai-grammar-output");
    const aiGrammarArea = document.getElementById("ai-grammar-area");
    const grammarNote   = document.getElementById("grammar-note");

    // ============================================
    // LANGUAGE LOADING
    // ============================================

    function loadLanguages() {
        appLanguages = JSON.parse(JSON.stringify(window.LANGUAGES || {}));
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const custom = JSON.parse(saved);
                for (const [id, data] of Object.entries(custom)) {
                    if (appLanguages[id]) {
                        appLanguages[id].dict = { ...appLanguages[id].dict, ...data.dict };
                    } else {
                        appLanguages[id] = data;
                    }
                }
            }
        } catch (e) { console.error("Failed to load custom languages", e); }
    }

    function saveToStorage() {
        const toSave = {};
        for (const [id, lang] of Object.entries(appLanguages)) {
            const base = window.LANGUAGES[id];
            if (!base) {
                toSave[id] = lang;
            } else {
                const customDict = {};
                for (const [eng, trans] of Object.entries(lang.dict)) {
                    if (!base.dict[eng] || base.dict[eng] !== trans) customDict[eng] = trans;
                }
                if (Object.keys(customDict).length > 0) toSave[id] = { dict: customDict };
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    }

    function getLanguage(id) { return appLanguages[id]; }

    function buildReverseDict(dict) {
        const rev = {};
        for (const [eng, trans] of Object.entries(dict)) {
            const key = trans.toLowerCase();
            if (!rev[key]) rev[key] = eng;
        }
        return rev;
    }

    // ============================================
    // LAYER 0–2: TRANSLATION PIPELINE
    // ============================================

    // Source tags for UI colouring
    const SRC = { EXACT: "exact", LEMMA: "lemma", SYNONYM: "synonym", MISS: "miss", SPACE: "space", PUNCT: "punct" };

    function lookupWord(token, dict) {
        const lower = token.toLowerCase();

        // L0: exact match
        if (dict[lower]) return { translated: dict[lower], source: SRC.EXACT };

        // For reverse mode we stop at L0
        if (isReversed) return null;

        // L1: lemmatized forms
        if (window.FPG_Lemmatizer) {
            const lemmas = FPG_Lemmatizer.lemmatize(lower);
            for (const lemma of lemmas) {
                if (lemma !== lower && dict[lemma]) {
                    return { translated: dict[lemma], source: SRC.LEMMA, via: lemma };
                }
            }
            // L2: synonym expansion — try original AND each lemma form
            if (window.FPG_Synonyms) {
                const dictKeys = Object.keys(dict);
                const keysSet = new Set(dictKeys);
                const candidates = [lower, ...lemmas.filter(l => l !== lower)];
                for (const candidate of candidates) {
                    const match = FPG_Synonyms.findMatch(candidate, keysSet);
                    if (match && dict[match]) {
                        return { translated: dict[match], source: SRC.SYNONYM, via: match };
                    }
                }
            }
        }

        return null;
    }

    function matchCase(source, target) {
        if (source === source.toUpperCase() && source.length > 1) return target.toUpperCase();
        if (source[0] === source[0].toUpperCase()) return target.charAt(0).toUpperCase() + target.slice(1);
        return target;
    }

    function translateText(text, dict) {
        const words = text.split(/(\s+)/);
        const result = [];
        let i = 0;

        while (i < words.length) {
            if (/^\s+$/.test(words[i])) {
                result.push({ original: words[i], translated: words[i], source: SRC.SPACE });
                i++;
                continue;
            }

            // Try multi-word phrase match first (L0 exact only for phrases)
            let matched = false;
            for (let len = Math.min(7, words.length - i); len > 1; len -= 2) {
                const phraseTokens = words.slice(i, i + len);
                const phrase = phraseTokens.join("").toLowerCase().trim();
                const lookup = isReversed ? reverseDict : dict;
                if (lookup[phrase]) {
                    result.push({
                        original: phraseTokens.join(""),
                        translated: matchCase(phraseTokens.join(""), lookup[phrase]),
                        source: SRC.EXACT,
                        isPhrase: true,
                    });
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;

            const token = words[i];
            if (/^\w+$/.test(token)) {
                if (isReversed) {
                    const hit = reverseDict[token.toLowerCase()];
                    result.push(hit
                        ? { original: token, translated: matchCase(token, hit), source: SRC.EXACT }
                        : { original: token, translated: token, source: SRC.MISS }
                    );
                } else {
                    const hit = lookupWord(token, dict);
                    result.push(hit
                        ? { original: token, translated: matchCase(token, hit.translated), source: hit.source, via: hit.via }
                        : { original: token, translated: token, source: SRC.MISS }
                    );
                }
            } else {
                result.push({ original: token, translated: token, source: SRC.PUNCT });
            }
            i++;
        }

        return result;
    }

    // ============================================
    // LAYER 3: GEMINI GRAMMAR REORDERING
    // ============================================

    function getGeminiKey() {
        return localStorage.getItem(GEMINI_KEY) || "";
    }

    function updateAiStatus() {
        const key = getGeminiKey();
        if (key) {
            aiStatus.textContent = "API key saved";
            aiStatus.className = "ai-status ai-status--ok";
            aiKeyInput.value = "••••••••••••••••";
            aiGrammarBtn.disabled = false;
        } else {
            aiStatus.textContent = "No API key — grammar layer inactive";
            aiStatus.className = "ai-status ai-status--off";
            aiKeyInput.value = "";
            aiGrammarBtn.disabled = true;
        }
    }

    async function applyGrammarLayer(results, langId) {
        const key = getGeminiKey();
        if (!key) return;

        const profile = GRAMMAR[langId];
        if (!profile) return;

        const lang = getLanguage(langId);
        if (!lang) return;

        // Build a readable summary of what was translated
        const translatedPairs = results
            .filter(r => r.source !== SRC.SPACE && r.source !== SRC.PUNCT && r.source !== SRC.MISS)
            .map(r => `"${r.original}" → "${r.translated}"`)
            .join(", ");

        const missingWords = results
            .filter(r => r.source === SRC.MISS)
            .map(r => r.original)
            .join(", ");

        const originalText = results.map(r => r.original).join("");
        const rawTranslation = results
            .filter(r => r.source !== SRC.SPACE && r.source !== SRC.PUNCT)
            .map(r => r.translated)
            .join(" ");

        const prompt = `You are a grammar assistant for the constructed language "${lang.name}".

Grammar rule: ${profile.note}

The user typed: "${originalText}"
Word-by-word translation produced: ${translatedPairs || "(none)"}
${missingWords ? `Words not in dictionary (kept as English): ${missingWords}` : ""}
Raw word-by-word output: "${rawTranslation}"

Task: Reorder ONLY the translated ${lang.name} words to follow ${profile.order} word order. Keep untranslated English words in a natural position. Do not invent new words. Do not add grammar particles that are not in the word list. Output the final reordered sentence only — no explanation.`;

        aiGrammarBtn.textContent = "Reordering…";
        aiGrammarBtn.disabled = true;

        try {
            const res = await fetch(`${GEMINI_URL}?key=${key}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error?.message || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) {
                aiGrammarArea.style.display = "";
                aiGrammarOut.textContent = text;
            }
        } catch (e) {
            aiGrammarArea.style.display = "";
            aiGrammarOut.textContent = `Error: ${e.message}`;
        } finally {
            aiGrammarBtn.textContent = "Apply Grammar (Gemini)";
            aiGrammarBtn.disabled = false;
        }
    }

    // ============================================
    // RENDER
    // ============================================

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function renderLanguageSelector() {
        langSelector.innerHTML = "";
        const icons = { klingon: "🖖", sindarin: "🧝", dovahzul: "🐉", dothraki: "🐎", valyrian: "🔥" };
        for (const [id, lang] of Object.entries(appLanguages)) {
            const btn = document.createElement("button");
            btn.className = `lang-card ${id === activeLanguageId ? "active" : ""}`;
            btn.dataset.lang = id;
            btn.innerHTML = `
                <span class="lang-card__icon">${icons[id] || "📘"}</span>
                <div class="lang-card__body">
                    <div class="lang-card__name">${escapeHtml(lang.name)}</div>
                    <div class="lang-card__universe">${escapeHtml(lang.universe || "Custom")}</div>
                </div>`;
            btn.addEventListener("click", () => selectLanguage(id));
            langSelector.appendChild(btn);
        }
    }

    function selectLanguage(id) {
        activeLanguageId = id;
        const lang = getLanguage(id);
        if (!lang) return;

        langSelector.querySelectorAll(".lang-card").forEach(c =>
            c.classList.toggle("active", c.dataset.lang === id)
        );
        langTitle.textContent   = lang.name;
        langNative.textContent  = lang.nativeName || lang.name;
        langDesc.textContent    = lang.desc || "";
        langUniverse.textContent = lang.universe || "";

        reverseDict = buildReverseDict(lang.dict);
        renderDictionary();
        if (inputArea.value.trim()) translate();
        updateDirectionLabel();
        updateGrammarNote(id);
        aiGrammarArea.style.display = "none";
    }

    function updateDirectionLabel() {
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;
        dirLabel.textContent = isReversed
            ? `${lang.name} → English`
            : `English → ${lang.name}`;
    }

    function updateGrammarNote(id) {
        const profile = GRAMMAR[id];
        grammarNote.textContent = profile
            ? `Word order: ${profile.order} — ${profile.note}`
            : "No grammar profile for this language yet.";
    }

    let lastResults = null;

    function translate() {
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;
        const text = inputArea.value.trim();
        if (!text) {
            outputArea.innerHTML = '<span class="output-placeholder">Translation will appear here…</span>';
            updateStats(0, 0, 0, 0, 0);
            return;
        }

        const results = translateText(text, lang.dict);
        lastResults = results;
        aiGrammarArea.style.display = "none";

        let html = "";
        let total = 0, exact = 0, lemmaCount = 0, synonymCount = 0, missing = 0;

        for (const r of results) {
            if (r.source === SRC.SPACE || r.source === SRC.PUNCT) {
                html += `<span class="trans-punct">${escapeHtml(r.translated)}</span>`;
                continue;
            }
            total++;
            if (r.source === SRC.EXACT) {
                exact++;
                html += `<span class="trans-word trans-found trans-exact" title="${escapeHtml(r.original)}">${escapeHtml(r.translated)}</span>`;
            } else if (r.source === SRC.LEMMA) {
                lemmaCount++;
                html += `<span class="trans-word trans-found trans-lemma" title="Via lemma: ${escapeHtml(r.original)} → ${escapeHtml(r.via)}">${escapeHtml(r.translated)}</span>`;
            } else if (r.source === SRC.SYNONYM) {
                synonymCount++;
                html += `<span class="trans-word trans-found trans-synonym" title="Via synonym: ${escapeHtml(r.original)} ≈ ${escapeHtml(r.via)}">${escapeHtml(r.translated)}</span>`;
            } else {
                missing++;
                html += `<span class="trans-word trans-missing" title="Not in dictionary">${escapeHtml(r.translated)}</span>`;
            }
        }

        outputArea.innerHTML = html;
        updateStats(total, exact, lemmaCount, synonymCount, missing);
    }

    function updateStats(total, exact, lemma, synonym, missing) {
        statsTotal.textContent      = total;
        statsTranslated.textContent = exact + lemma + synonym;
        statsMissing.textContent    = missing;
        statsLemma.textContent      = lemma;
        statsSynonym.textContent    = synonym;
    }

    function renderDictionary(filter) {
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;
        const entries = Object.entries(lang.dict);
        const filtered = filter
            ? entries.filter(([e, t]) => e.includes(filter.toLowerCase()) || t.toLowerCase().includes(filter.toLowerCase()))
            : entries;
        filtered.sort((a, b) => a[0].localeCompare(b[0]));
        dictCount.textContent = `${filtered.length} of ${entries.length} entries`;
        dictList.innerHTML = "";
        for (const [eng, trans] of filtered) {
            const row = document.createElement("div");
            row.className = "dict-row";
            row.innerHTML = `<span class="dict-eng">${escapeHtml(eng)}</span><span class="dict-arrow">→</span><span class="dict-trans">${escapeHtml(trans)}</span>`;
            row.addEventListener("click", () => {
                const word = isReversed ? trans : eng;
                inputArea.value += (inputArea.value ? " " : "") + word;
                inputArea.focus();
            });
            dictList.appendChild(row);
        }
    }

    // ============================================
    // DICTIONARY MANAGER
    // ============================================

    function togglePanel(id) {
        const target = document.getElementById(id);
        [panelAddWord, panelAddLang, panelImport].forEach(p => {
            if (p !== target) p.classList.add("hidden");
        });
        target.classList.toggle("hidden");
    }

    function addCustomWord() {
        const eng = inputWordEng.value.trim().toLowerCase();
        const trans = inputWordTrans.value.trim();
        if (!eng || !trans) return;
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;
        lang.dict[eng] = trans;
        saveToStorage();
        reverseDict = buildReverseDict(lang.dict);
        renderDictionary(dictSearch.value.trim());
        if (inputArea.value.trim()) translate();
        inputWordEng.value = "";
        inputWordTrans.value = "";
        inputWordEng.focus();
    }

    function addCustomLanguage() {
        const id   = inputLangId.value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const name = inputLangName.value.trim();
        if (!id || !name || appLanguages[id]) return;
        appLanguages[id] = { name, nativeName: name, universe: "Custom", desc: "Custom language.", dict: {} };
        saveToStorage();
        renderLanguageSelector();
        selectLanguage(id);
        inputLangId.value = "";
        inputLangName.value = "";
        panelAddLang.classList.add("hidden");
    }

    function handleImport() {
        const data = inputImportData.value.trim();
        if (!data) return;
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;
        let added = 0;
        try {
            if (data.startsWith("{")) {
                const parsed = JSON.parse(data);
                for (const [k, v] of Object.entries(parsed)) { lang.dict[k.toLowerCase()] = String(v); added++; }
            } else {
                for (const line of data.split("\n")) {
                    const parts = line.split(",");
                    if (parts.length >= 2) {
                        const eng = parts[0].trim().toLowerCase();
                        const trans = parts.slice(1).join(",").trim();
                        if (eng && trans) { lang.dict[eng] = trans; added++; }
                    }
                }
            }
            if (added > 0) {
                saveToStorage();
                reverseDict = buildReverseDict(lang.dict);
                renderDictionary(dictSearch.value.trim());
                if (inputArea.value.trim()) translate();
                inputImportData.value = "";
                panelImport.classList.add("hidden");
            }
        } catch (e) { console.error("Import error", e); }
    }

    function exportDictionary() {
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;
        const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lang.dict, null, 2));
        const a = document.createElement("a");
        a.href = dataUri;
        a.download = `${activeLanguageId}_dict.json`;
        a.click();
    }

    // ============================================
    // EVENTS
    // ============================================

    btnToggleWord.addEventListener("click",   () => togglePanel("panel-add-word"));
    btnToggleLang.addEventListener("click",   () => togglePanel("panel-add-lang"));
    btnToggleImport.addEventListener("click", () => togglePanel("panel-import"));
    btnExport.addEventListener("click", exportDictionary);
    btnSaveWord.addEventListener("click", addCustomWord);
    btnSaveLang.addEventListener("click", addCustomLanguage);
    btnSaveImport.addEventListener("click", handleImport);
    inputWordTrans.addEventListener("keypress", e => { if (e.key === "Enter") addCustomWord(); });

    inputArea.addEventListener("input", translate);

    dirToggle.addEventListener("click", () => {
        isReversed = !isReversed;
        updateDirectionLabel();
        translate();
    });

    clearBtn.addEventListener("click", () => {
        inputArea.value = "";
        outputArea.innerHTML = '<span class="output-placeholder">Translation will appear here…</span>';
        updateStats(0, 0, 0, 0, 0);
        aiGrammarArea.style.display = "none";
        inputArea.focus();
    });

    copyBtn.addEventListener("click", () => {
        const text = outputArea.textContent;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            copyLabel.textContent = "Copied!";
            copyBtn.classList.add("copied");
            setTimeout(() => { copyLabel.textContent = "Copy"; copyBtn.classList.remove("copied"); }, 1500);
        });
    });

    dictSearch.addEventListener("input", () => renderDictionary(dictSearch.value.trim()));

    // AI settings
    aiSaveBtn.addEventListener("click", () => {
        const val = aiKeyInput.value.trim();
        if (val && !val.startsWith("•")) {
            localStorage.setItem(GEMINI_KEY, val);
        }
        updateAiStatus();
    });

    aiClearBtn.addEventListener("click", () => {
        localStorage.removeItem(GEMINI_KEY);
        updateAiStatus();
    });

    aiGrammarBtn.addEventListener("click", () => {
        if (lastResults) applyGrammarLayer(lastResults, activeLanguageId);
    });

    // ============================================
    // INIT
    // ============================================

    loadLanguages();
    renderLanguageSelector();
    selectLanguage(Object.keys(appLanguages)[0] || "klingon");
    updateAiStatus();
    inputArea.focus();
})();
