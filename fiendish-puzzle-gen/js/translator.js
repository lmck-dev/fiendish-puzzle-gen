/* =============================================
   Fiendish Puzzle Gen — Language Translator Engine
   ============================================= */

(function () {
    "use strict";

    // ============================================
    // STATE
    // ============================================

    const LOCAL_STORAGE_KEY = "fpg_custom_languages";
    let appLanguages = {};
    let activeLanguageId = "klingon";
    let isReversed = false; // false = English→Fantasy, true = Fantasy→English
    let reverseDict = {};   // built from active language's dict

    // ============================================
    // DOM REFERENCES
    // ============================================

    const langSelector = document.getElementById("lang-selector");
    const inputArea = document.getElementById("trans-input");
    const outputArea = document.getElementById("trans-output");
    const clearBtn = document.getElementById("clear-trans-btn");
    const copyBtn = document.getElementById("copy-trans-btn");
    const copyLabel = document.getElementById("copy-trans-label");
    const dirToggle = document.getElementById("trans-direction");
    const dirLabel = document.getElementById("trans-dir-label");
    const langTitle = document.getElementById("lang-title");
    const langNative = document.getElementById("lang-native");
    const langDesc = document.getElementById("lang-desc");
    const langUniverse = document.getElementById("lang-universe");
    const dictSearch = document.getElementById("dict-search");
    const dictList = document.getElementById("dict-list");
    const dictCount = document.getElementById("dict-count");
    const statsTotal = document.getElementById("stats-total");
    const statsTranslated = document.getElementById("stats-translated");
    const statsMissing = document.getElementById("stats-missing");

    // Manager
    const btnToggleWord = document.getElementById("btn-toggle-word");
    const btnToggleLang = document.getElementById("btn-toggle-lang");
    const btnToggleImport = document.getElementById("btn-toggle-import");
    const btnExport = document.getElementById("btn-export");
    
    const panelAddWord = document.getElementById("panel-add-word");
    const panelAddLang = document.getElementById("panel-add-lang");
    const panelImport = document.getElementById("panel-import");
    
    const btnSaveWord = document.getElementById("btn-save-word");
    const inputWordEng = document.getElementById("input-word-eng");
    const inputWordTrans = document.getElementById("input-word-trans");
    
    const btnSaveLang = document.getElementById("btn-save-lang");
    const inputLangId = document.getElementById("input-lang-id");
    const inputLangName = document.getElementById("input-lang-name");
    
    const btnSaveImport = document.getElementById("btn-save-import");
    const inputImportData = document.getElementById("input-import-data");

    // ============================================
    // HELPERS
    // ============================================

    function loadLanguages() {
        // Deep copy default languages
        appLanguages = JSON.parse(JSON.stringify(window.LANGUAGES || {}));
        
        // Merge custom from localStorage
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (saved) {
                const customLangs = JSON.parse(saved);
                for (const [id, data] of Object.entries(customLangs)) {
                    if (appLanguages[id]) {
                        // Merge dict if default language exists
                        appLanguages[id].dict = { ...appLanguages[id].dict, ...data.dict };
                    } else {
                        // Add new custom language
                        appLanguages[id] = data;
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load custom languages", e);
        }
    }

    function saveToStorage() {
        // Only save what is NOT in defaults, OR differences.
        // For simplicity, we just save any language that has been modified,
        // excluding default keys if we want to save space.
        // To be safe and simple: just grab all languages, and for base ones
        // only save dict entries that aren't in window.LANGUAGES.
        const toSave = {};
        for (const [id, lang] of Object.entries(appLanguages)) {
            const baseLang = window.LANGUAGES[id];
            if (!baseLang) {
                toSave[id] = lang; // entire custom language
            } else {
                // Find custom words added to default ones
                const customDict = {};
                for (const [eng, trans] of Object.entries(lang.dict)) {
                    if (!baseLang.dict[eng] || baseLang.dict[eng] !== trans) {
                        customDict[eng] = trans;
                    }
                }
                if (Object.keys(customDict).length > 0) {
                    toSave[id] = { dict: customDict };
                }
            }
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(toSave));
    }

    function getLanguage(id) {
        return appLanguages[id];
    }

    function buildReverseDict(dict) {
        const rev = {};
        for (const [eng, trans] of Object.entries(dict)) {
            const key = trans.toLowerCase();
            if (!rev[key]) rev[key] = eng;
        }
        return rev;
    }

    function tokenize(text) {
        // Split into tokens preserving punctuation and whitespace
        return text.match(/[\w'']+|[^\w'']+/g) || [];
    }

    function translateToken(token, dict, reverse) {
        const lower = token.toLowerCase();

        if (reverse) {
            // Fantasy → English
            if (reverseDict[lower]) {
                const result = reverseDict[lower];
                return { original: token, translated: matchCase(token, result), found: true };
            }
        } else {
            // English → Fantasy
            if (dict[lower]) {
                const result = dict[lower];
                return { original: token, translated: matchCase(token, result), found: true };
            }
        }

        return { original: token, translated: token, found: false };
    }

    function matchCase(source, target) {
        if (source === source.toUpperCase() && source.length > 1) {
            return target.toUpperCase();
        }
        if (source[0] === source[0].toUpperCase()) {
            return target.charAt(0).toUpperCase() + target.slice(1);
        }
        return target;
    }

    // Try multi-word phrases first (longest match)
    function translateText(text, dict) {
        const words = text.split(/(\s+)/);
        const result = [];
        let i = 0;

        while (i < words.length) {
            // Skip whitespace tokens
            if (/^\s+$/.test(words[i])) {
                result.push({ original: words[i], translated: words[i], found: true, isSpace: true });
                i++;
                continue;
            }

            // Try matching multi-word phrases (up to 4 words)
            let matched = false;
            for (let len = Math.min(7, words.length - i); len > 1; len -= 2) {
                // len steps by 2 to skip space tokens between words
                const phraseTokens = words.slice(i, i + len);
                const phrase = phraseTokens.join("").toLowerCase().trim();

                const lookup = isReversed ? reverseDict : dict;
                const found = isReversed ? reverseDict[phrase] : dict[phrase];

                if (found) {
                    const translated = matchCase(phraseTokens.join(""), found);
                    result.push({ original: phraseTokens.join(""), translated, found: true, isPhrase: true });
                    i += len;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                // Single word lookup
                const token = words[i];
                if (/^\w+$/.test(token)) {
                    const tr = translateToken(token, dict, isReversed);
                    result.push(tr);
                } else {
                    result.push({ original: token, translated: token, found: true, isPunct: true });
                }
                i++;
            }
        }

        return result;
    }

    // ============================================
    // UI CONTROLLER
    // ============================================

    function renderLanguageSelector() {
        langSelector.innerHTML = "";
        
        // Define default icons
        const icons = {
            "klingon": "🖖", "sindarin": "🧝", "dovahzul": "🐉",
            "dothraki": "🐎", "valyrian": "🔥"
        };

        for (const [id, lang] of Object.entries(appLanguages)) {
            const icon = icons[id] || "📘";
            const universe = lang.universe || "Custom";
            
            const btn = document.createElement("button");
            btn.className = `lang-card ${id === activeLanguageId ? 'active' : ''}`;
            btn.dataset.lang = id;
            btn.innerHTML = `
                <span class="lang-card__icon">${icon}</span>
                <div class="lang-card__body">
                    <div class="lang-card__name">${escapeHtml(lang.name)}</div>
                    <div class="lang-card__universe">${escapeHtml(universe)}</div>
                </div>
            `;
            
            btn.addEventListener("click", () => selectLanguage(id));
            langSelector.appendChild(btn);
        }
    }

    function selectLanguage(id) {
        activeLanguageId = id;
        const lang = getLanguage(id);
        if (!lang) return;

        // Update cards
        const cards = langSelector.querySelectorAll(".lang-card");
        cards.forEach(card => card.classList.toggle("active", card.dataset.lang === id));

        // Update info
        langTitle.textContent = lang.name;
        langNative.textContent = lang.nativeName;
        langDesc.textContent = lang.desc;
        langUniverse.textContent = lang.universe;

        // Build reverse dictionary
        reverseDict = buildReverseDict(lang.dict);

        // Update dictionary browser
        renderDictionary();

        // Re-translate if there's input
        if (inputArea.value.trim()) {
            translate();
        }

        updateDirectionLabel();
    }

    function updateDirectionLabel() {
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;

        if (isReversed) {
            dirLabel.textContent = `${lang.name} → English`;
        } else {
            dirLabel.textContent = `English → ${lang.name}`;
        }
    }

    function translate() {
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;

        const text = inputArea.value.trim();
        if (!text) {
            outputArea.innerHTML = '<span class="output-placeholder">Translation will appear here…</span>';
            updateStats(0, 0, 0);
            return;
        }

        const results = translateText(text, lang.dict);

        // Render output
        let html = "";
        let totalWords = 0;
        let translatedWords = 0;
        let missingWords = 0;

        for (const r of results) {
            if (r.isSpace || r.isPunct) {
                html += `<span class="trans-punct">${escapeHtml(r.translated)}</span>`;
                continue;
            }

            totalWords++;
            if (r.found) {
                translatedWords++;
                html += `<span class="trans-word trans-found" title="${escapeHtml(r.original)}">${escapeHtml(r.translated)}</span>`;
            } else {
                missingWords++;
                html += `<span class="trans-word trans-missing" title="Not in dictionary">${escapeHtml(r.translated)}</span>`;
            }
        }

        outputArea.innerHTML = html;
        updateStats(totalWords, translatedWords, missingWords);
    }

    function updateStats(total, translated, missing) {
        statsTotal.textContent = total;
        statsTranslated.textContent = translated;
        statsMissing.textContent = missing;
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function renderDictionary(filter) {
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;

        const entries = Object.entries(lang.dict);
        const filtered = filter
            ? entries.filter(([eng, trans]) =>
                eng.includes(filter.toLowerCase()) || trans.toLowerCase().includes(filter.toLowerCase())
            )
            : entries;

        // Sort alphabetically by English
        filtered.sort((a, b) => a[0].localeCompare(b[0]));

        dictCount.textContent = `${filtered.length} of ${entries.length} entries`;

        dictList.innerHTML = "";
        for (const [eng, trans] of filtered) {
            const row = document.createElement("div");
            row.className = "dict-row";
            row.innerHTML = `<span class="dict-eng">${escapeHtml(eng)}</span><span class="dict-arrow">→</span><span class="dict-trans">${escapeHtml(trans)}</span>`;

            // Click to insert word into input
            row.addEventListener("click", () => {
                const word = isReversed ? trans : eng;
                inputArea.value += (inputArea.value ? " " : "") + word;
                inputArea.focus();
            });

            dictList.appendChild(row);
        }
    }

    // ============================================
    // DICTIONARY MANAGER ACTIONS
    // ============================================
    
    function togglePanel(panelId) {
        const panels = [panelAddWord, panelAddLang, panelImport];
        panels.forEach(p => {
            if (p.id === panelId) p.classList.toggle("hidden");
            else p.classList.add("hidden");
        });
    }

    function addCustomWord() {
        const eng = inputWordEng.value.trim().toLowerCase();
        const trans = inputWordTrans.value.trim();
        
        if (!eng || !trans) return alert("Please fill out both English and Translation fields.");
        
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;

        lang.dict[eng] = trans;
        saveToStorage();
        
        // Refresh UI
        reverseDict = buildReverseDict(lang.dict);
        renderDictionary(dictSearch.value.trim());
        if (inputArea.value.trim()) translate();
        
        inputWordEng.value = "";
        inputWordTrans.value = "";
        inputWordEng.focus();
    }

    function addCustomLanguage() {
        let id = inputLangId.value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const name = inputLangName.value.trim();
        
        if (!id || !name) return alert("Please provide an ID and Name.");
        if (appLanguages[id]) return alert("A language with this ID already exists.");

        appLanguages[id] = {
            name: name,
            nativeName: name,
            universe: "Custom",
            desc: "Custom language created by user.",
            dict: {}
        };
        
        saveToStorage();
        renderLanguageSelector();
        selectLanguage(id);
        
        inputLangId.value = "";
        inputLangName.value = "";
        panelAddLang.classList.add("hidden");
    }

    function handleImport() {
        const data = inputImportData.value.trim();
        if (!data) return alert("Please paste some JSON or CSV data.");
        
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;

        let added = 0;
        
        try {
            // First try JSON
            if (data.startsWith("{")) {
                const parsed = JSON.parse(data);
                for (const [k, v] of Object.entries(parsed)) {
                    lang.dict[k.toLowerCase()] = String(v);
                    added++;
                }
            } else {
                // Try simple CSV "english,translation"
                const lines = data.split('\n');
                for (const line of lines) {
                    const parts = line.split(',');
                    if (parts.length >= 2) {
                        const eng = parts[0].trim().toLowerCase();
                        const trans = parts.slice(1).join(',').trim();
                        if (eng && trans) {
                            lang.dict[eng] = trans;
                            added++;
                        }
                    }
                }
            }
            
            if (added > 0) {
                saveToStorage();
                reverseDict = buildReverseDict(lang.dict);
                renderDictionary(dictSearch.value.trim());
                if (inputArea.value.trim()) translate();
                alert(`Successfully added ${added} words to ${lang.name}!`);
                inputImportData.value = "";
                panelImport.classList.add("hidden");
            } else {
                alert("No valid words found to import. Check format.");
            }
        } catch (e) {
            alert("Error parsing data. Make sure it's valid JSON or CSV.");
            console.error(e);
        }
    }

    function exportDictionary() {
        const lang = getLanguage(activeLanguageId);
        if (!lang) return;
        
        const dataStr = JSON.stringify(lang.dict, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `${activeLanguageId}_dict.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    // ============================================
    // EVENT BINDINGS
    // ============================================

    // Dictionary Actions
    btnToggleWord.addEventListener("click", () => togglePanel("panel-add-word"));
    btnToggleLang.addEventListener("click", () => togglePanel("panel-add-lang"));
    btnToggleImport.addEventListener("click", () => togglePanel("panel-import"));
    btnExport.addEventListener("click", exportDictionary);
    
    btnSaveWord.addEventListener("click", addCustomWord);
    btnSaveLang.addEventListener("click", addCustomLanguage);
    btnSaveImport.addEventListener("click", handleImport);

    // Enter key submits for add word
    inputWordTrans.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addCustomWord();
    });

    // Real-time translation on input
    inputArea.addEventListener("input", () => {
        translate();
    });

    // Direction toggle
    dirToggle.addEventListener("click", () => {
        isReversed = !isReversed;
        updateDirectionLabel();
        translate();
    });

    // Clear
    clearBtn.addEventListener("click", () => {
        inputArea.value = "";
        outputArea.innerHTML = '<span class="output-placeholder">Translation will appear here…</span>';
        updateStats(0, 0, 0);
        inputArea.focus();
    });

    // Copy
    copyBtn.addEventListener("click", () => {
        const text = outputArea.textContent;
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

    // Dictionary search
    dictSearch.addEventListener("input", () => {
        renderDictionary(dictSearch.value.trim());
    });

    // ============================================
    // INIT
    // ============================================

    loadLanguages();
    renderLanguageSelector();
    selectLanguage(Object.keys(appLanguages)[0] || "klingon");
    inputArea.focus();
})();
