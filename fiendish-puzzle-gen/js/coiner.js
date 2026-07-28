/* =============================================
   Fiendish Puzzle Gen — Word Coiner (FPG_Coiner)

   Learns a language's PHONOTACTICS from its own existing lexicon and
   generates novel words that "sound native". No neural net: a plain
   character-level n-gram (Markov) model over the target-language words
   captures the flavour — Klingon's guttural clusters and apostrophes vs
   Sindarin's flowing vowels fall out of the statistics automatically.

   This is the "coinage" rung of the lexical-gap cascade. Anything it
   produces is a COINAGE and must be flagged as such by the caller — it is
   never part of an originator's canonical lexicon.

   Public API:
     train(words, order?)        -> model      (words = target-language word list)
     trainFromDict(dict, order?) -> model       (dict  = {english: "translation"})
     coin(model, opts?)          -> string|null (a novel word; null if it couldn't)
     score(model, word)          -> number       (avg log-prob/char; higher = more native)
     tokenize(value)             -> string[]      (split a dict value into words)
   ============================================= */

(function (root) {
    "use strict";

    const START = "";   // context padding (start of word)
    const END   = "";   // end-of-word marker

    // A dictionary value may hold several target words ("darkmans lane",
    // "upright man") — train on each word individually, not the phrase.
    function tokenize(value) {
        return String(value)
            .split(/[\s,;/()]+/)
            .map(w => w.trim())
            .filter(Boolean);
    }

    // Build an order-N character model from a list of target-language words.
    function train(words, order) {
        order = order || 3;
        const model = {
            order,
            trans: Object.create(null),   // ctx (order chars) -> { nextChar: count }
            lexicon: new Set(),           // known words, lowercased (novelty guard)
            minLen: 3, maxLen: 12, avgLen: 6,
        };
        const lengths = [];
        for (const raw of words) {
            const w = (raw || "").trim();
            if (!w) continue;
            model.lexicon.add(w.toLowerCase());
            const chars = Array.from(w);        // code points — keeps ’ and accents intact
            lengths.push(chars.length);
            const seq = new Array(order).fill(START).concat(chars, END);
            for (let i = order; i < seq.length; i++) {
                const ctx = seq.slice(i - order, i).join("");
                const next = seq[i];
                const row = model.trans[ctx] || (model.trans[ctx] = Object.create(null));
                row[next] = (row[next] || 0) + 1;
            }
        }
        if (lengths.length) {
            lengths.sort((a, b) => a - b);
            model.minLen = lengths[0];
            model.maxLen = lengths[lengths.length - 1];
            model.avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        }
        return model;
    }

    function trainFromDict(dict, order) {
        const words = [];
        for (const value of Object.values(dict || {})) {
            for (const tok of tokenize(value)) words.push(tok);
        }
        return train(words, order);
    }

    // Small seedable PRNG (mulberry32) so coinage is reproducible when a seed
    // is given — important for tests and for puzzle round-trips. Falls back to
    // Math.random for natural variety.
    function makeRng(seed) {
        if (seed == null) return Math.random;
        let s = seed >>> 0;
        return function () {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function sampleNext(counts, rng) {
        let total = 0;
        for (const k in counts) total += counts[k];
        let r = rng() * total;
        for (const k in counts) { r -= counts[k]; if (r < 0) return k; }
        return END;
    }

    // Generate a novel word. Rejects words already in the lexicon, words in the
    // caller-supplied `exclude` set (e.g. already-coined surface forms — keeps a
    // language a clean bijection), and words outside the observed length band.
    // Retries up to `attempts` from the seeded stream, so a given seed is stable.
    function coin(model, opts) {
        opts = opts || {};
        const rng    = makeRng(opts.seed);
        const minLen = opts.minLen || Math.max(2, Math.round(model.avgLen * 0.5));
        const maxLen = opts.maxLen || Math.max(model.maxLen, Math.ceil(model.avgLen * 2));
        const attempts = opts.attempts || 60;
        const exclude = opts.exclude || null;   // Set of lowercased words to avoid

        for (let a = 0; a < attempts; a++) {
            const ctx = new Array(model.order).fill(START);
            const out = [];
            while (out.length < maxLen) {
                const row = model.trans[ctx.join("")];
                if (!row) break;
                const next = sampleNext(row, rng);
                if (next === END) break;
                out.push(next);
                ctx.push(next);
                ctx.shift();
            }
            const word = out.join("");
            const lc = word.toLowerCase();
            if (out.length >= minLen && !model.lexicon.has(lc) && !(exclude && exclude.has(lc))) {
                return word;
            }
        }
        return null;
    }

    // Average log-probability per character of `word` under the model.
    // Useful for ranking borrowings/candidates by how native they sound
    // (less negative = more native). Unseen contexts get a small floor.
    function score(model, word) {
        const chars = Array.from(String(word).trim());
        if (!chars.length) return -Infinity;
        const seq = new Array(model.order).fill(START).concat(chars, END);
        let logp = 0, n = 0;
        for (let i = model.order; i < seq.length; i++) {
            const ctx = seq.slice(i - model.order, i).join("");
            const row = model.trans[ctx];
            let p = 1e-6;
            if (row) {
                let total = 0;
                for (const k in row) total += row[k];
                p = (row[seq[i]] || 0) / total || 1e-6;
            }
            logp += Math.log(p);
            n++;
        }
        return logp / n;
    }

    const api = { train, trainFromDict, coin, score, tokenize };

    root.FPG_Coiner = api;                                    // browser: window.FPG_Coiner
    if (typeof module !== "undefined" && module.exports) {   // node: require(...) for tests
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
