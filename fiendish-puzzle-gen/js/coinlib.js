/* =============================================
   Fiendish Puzzle Gen — Coined-Word Library (FPG_CoinLib)

   The "non-canon" layer of the translator. Fills lexical gaps with words
   invented by FPG_Coiner, kept STRICTLY separate from the canon lexicon so
   the originators' vocabulary stays pristine and unmixed.

   Provenance tiers:
     canon  — originator lexicon (window.LANGUAGES), read-only, always on
     coined — algorithm-invented, UNEDITED (this module)
     custom — user hand-authored words (translator.js, separate storage)

   Convergence toward a common word set is free and backend-less: coinage is
   seeded deterministically from hash(concept + language), so the same concept
   yields the same word for everyone on the same dictionary version. Minted
   words are then PINNED in the library so they survive later dictionary
   growth, and a dup-check keeps every language a bijection (concept <-> word)
   for the self-reversible translator.

   Storage (localStorage, per the backend-free slice — swap for a server-backed
   store when accounts land; the data model is identical):
     fpg_coined_library : { [langId]: { forward:{concept:word}, reverse:{word:concept}, nonce:{} } }
     fpg_allow_noncanon : "1" | "0"
   ============================================= */

window.FPG_CoinLib = (function () {
    "use strict";

    const LIB_KEY    = "fpg_coined_library";
    const TOGGLE_KEY = "fpg_allow_noncanon";
    const GOLDEN     = 0x9e3779b1;   // odd salt step for retry seeds

    let libs   = {};                 // in-memory mirror of LIB_KEY
    const models = Object.create(null);   // langId -> trained FPG_Coiner model (cache)

    // ---- persistence ----
    function load() {
        try { libs = JSON.parse(localStorage.getItem(LIB_KEY) || "{}") || {}; }
        catch (e) { libs = {}; }
    }
    function save() {
        try { localStorage.setItem(LIB_KEY, JSON.stringify(libs)); } catch (e) {}
    }
    function getLib(langId) {
        if (!libs[langId]) libs[langId] = { forward: {}, reverse: {}, nonce: {} };
        const l = libs[langId];
        l.forward = l.forward || {};
        l.reverse = l.reverse || {};
        l.nonce   = l.nonce   || {};
        return l;
    }

    // ---- toggle (the "accept non-canon libraries" setting) ----
    function isEnabled() { return localStorage.getItem(TOGGLE_KEY) === "1"; }
    function setEnabled(on) {
        try { localStorage.setItem(TOGGLE_KEY, on ? "1" : "0"); } catch (e) {}
    }

    // ---- deterministic seed: FNV-1a 32-bit over the concept+language ----
    function hashSeed(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }

    // Train (and cache) a phonotactic model from CANON words only — never the
    // user's custom words — so the model, and thus the coinage, is identical
    // across users at a given dictionary version. That identity IS the
    // cross-user convergence.
    function getModel(langId) {
        if (models[langId]) return models[langId];
        const canon = window.LANGUAGES && window.LANGUAGES[langId] && window.LANGUAGES[langId].dict;
        if (!canon || !window.FPG_Coiner) return null;
        return (models[langId] = window.FPG_Coiner.trainFromDict(canon, 3));
    }

    function coinWord(langId, seedBase, exclude) {
        const model = getModel(langId);
        if (!model) return null;
        for (let salt = 0; salt < 8; salt++) {
            const w = window.FPG_Coiner.coin(model, {
                seed: (seedBase + salt * GOLDEN) >>> 0,
                exclude,
            });
            if (w) return w;
        }
        return null;
    }

    // Look up an existing coinage without minting one.
    function lookup(concept, langId) {
        concept = String(concept).toLowerCase();
        const l = getLib(langId);
        return l.forward[concept] || null;
    }

    // Reverse: a coined surface form -> its English concept (for X -> English).
    function lookupReverse(word, langId) {
        const l = getLib(langId);
        return l.reverse[String(word).toLowerCase()] || null;
    }

    // Mint (or reuse) a coinage for a concept. Returns { word, reused } or null.
    function mint(concept, langId) {
        concept = String(concept).toLowerCase();
        if (!concept) return null;
        const l = getLib(langId);
        if (l.forward[concept]) return { word: l.forward[concept], reused: true };

        const exclude = new Set(Object.keys(l.reverse));
        const word = coinWord(langId, hashSeed(concept + "|" + langId), exclude);
        if (!word) return null;

        l.forward[concept] = word;
        l.reverse[word.toLowerCase()] = concept;
        save();
        return { word, reused: false };
    }

    // Discard the current coinage for a concept and mint a fresh, different one.
    function reroll(concept, langId) {
        concept = String(concept).toLowerCase();
        const l = getLib(langId);
        const prev = l.forward[concept];
        if (prev) { delete l.reverse[prev.toLowerCase()]; delete l.forward[concept]; }
        l.nonce[concept] = (l.nonce[concept] || 0) + 1;

        const exclude = new Set(Object.keys(l.reverse));
        const word = coinWord(langId, hashSeed(concept + "|" + langId + "|" + l.nonce[concept]), exclude);
        if (!word) return null;

        l.forward[concept] = word;
        l.reverse[word.toLowerCase()] = concept;
        save();
        return { word, reused: false };
    }

    function remove(concept, langId) {
        concept = String(concept).toLowerCase();
        const l = getLib(langId);
        const w = l.forward[concept];
        if (w) { delete l.reverse[w.toLowerCase()]; delete l.forward[concept]; save(); }
    }

    function clear(langId) {
        if (langId) { delete libs[langId]; } else { libs = {}; }
        save();
    }

    function count(langId) { return Object.keys(getLib(langId).forward).length; }
    function entries(langId) { return { ...getLib(langId).forward }; }

    load();

    return {
        isEnabled, setEnabled,
        mint, reroll, remove, clear,
        lookup, lookupReverse,
        count, entries, hashSeed,
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = window.FPG_CoinLib;
}
