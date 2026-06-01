/* =============================================
   FPG — Layer 1: English Lemmatizer
   Reduces inflected forms to their base (dictionary) form.
   Handles irregular verbs, regular verb suffixes, and plurals.
   No external dependencies.
   ============================================= */

window.FPG_Lemmatizer = (function () {
    "use strict";

    // ---- Irregular verb forms → base form ----
    // Format: inflected → base
    const IRREGULARS = {
        // be
        "am": "be", "is": "be", "are": "be", "was": "be", "were": "be",
        "been": "be", "being": "be",
        // have
        "has": "have", "had": "have", "having": "have",
        // do
        "does": "do", "did": "do", "done": "do", "doing": "do",
        // go
        "goes": "go", "went": "go", "gone": "go", "going": "go",
        // make
        "makes": "make", "made": "make", "making": "make",
        // take
        "takes": "take", "took": "take", "taken": "take", "taking": "take",
        // come
        "comes": "come", "came": "come", "coming": "come",
        // see
        "sees": "see", "saw": "see", "seen": "see", "seeing": "see",
        // know
        "knows": "know", "knew": "know", "known": "know", "knowing": "know",
        // think
        "thinks": "think", "thought": "think", "thinking": "think",
        // say
        "says": "say", "said": "say", "saying": "say",
        // get
        "gets": "get", "got": "get", "gotten": "get", "getting": "get",
        // give
        "gives": "give", "gave": "give", "given": "give", "giving": "give",
        // find
        "finds": "find", "found": "find", "finding": "find",
        // tell
        "tells": "tell", "told": "tell", "telling": "tell",
        // become
        "becomes": "become", "became": "become", "becoming": "become",
        // show
        "shows": "show", "showed": "show", "shown": "show", "showing": "show",
        // leave
        "leaves": "leave", "left": "leave", "leaving": "leave",
        // feel
        "feels": "feel", "felt": "feel", "feeling": "feel",
        // put — same form
        "puts": "put", "putting": "put",
        // bring
        "brings": "bring", "brought": "bring", "bringing": "bring",
        // begin
        "begins": "begin", "began": "begin", "begun": "begin", "beginning": "begin",
        // keep
        "keeps": "keep", "kept": "keep", "keeping": "keep",
        // hold
        "holds": "hold", "held": "hold", "holding": "hold",
        // write
        "writes": "write", "wrote": "write", "written": "write", "writing": "write",
        // stand
        "stands": "stand", "stood": "stand", "standing": "stand",
        // hear
        "hears": "hear", "heard": "hear", "hearing": "hear",
        // let — same form
        "lets": "let", "letting": "let",
        // mean
        "means": "mean", "meant": "mean", "meaning": "mean",
        // set — same form
        "sets": "set", "setting": "set",
        // meet
        "meets": "meet", "met": "meet", "meeting": "meet",
        // run
        "runs": "run", "ran": "run", "running": "run",
        // pay
        "pays": "pay", "paid": "pay", "paying": "pay",
        // sit
        "sits": "sit", "sat": "sit", "sitting": "sit",
        // speak
        "speaks": "speak", "spoke": "speak", "spoken": "speak", "speaking": "speak",
        // lead
        "leads": "lead", "led": "lead", "leading": "lead",
        // read — same spoken form but different spelling in past
        "reads": "read", "reading": "read",
        // grow
        "grows": "grow", "grew": "grow", "grown": "grow", "growing": "grow",
        // lose
        "loses": "lose", "lost": "lose", "losing": "lose",
        // fall
        "falls": "fall", "fell": "fall", "fallen": "fall", "falling": "fall",
        // send
        "sends": "send", "sent": "send", "sending": "send",
        // build
        "builds": "build", "built": "build", "building": "build",
        // understand
        "understands": "understand", "understood": "understand", "understanding": "understand",
        // draw
        "draws": "draw", "drew": "draw", "drawn": "draw", "drawing": "draw",
        // break
        "breaks": "break", "broke": "break", "broken": "break", "breaking": "break",
        // spend
        "spends": "spend", "spent": "spend", "spending": "spend",
        // cut — same form
        "cuts": "cut", "cutting": "cut",
        // rise
        "rises": "rise", "rose": "rise", "risen": "rise", "rising": "rise",
        // drive
        "drives": "drive", "drove": "drive", "driven": "drive", "driving": "drive",
        // buy
        "buys": "buy", "bought": "buy", "buying": "buy",
        // wear
        "wears": "wear", "wore": "wear", "worn": "wear", "wearing": "wear",
        // choose
        "chooses": "choose", "chose": "choose", "chosen": "choose", "choosing": "choose",
        // win
        "wins": "win", "won": "win", "winning": "win",
        // throw
        "throws": "throw", "threw": "throw", "thrown": "throw", "throwing": "throw",
        // catch
        "catches": "catch", "caught": "catch", "catching": "catch",
        // fight
        "fights": "fight", "fought": "fight", "fighting": "fight",
        // swim
        "swims": "swim", "swam": "swim", "swum": "swim", "swimming": "swim",
        // fly
        "flies": "fly", "flew": "fly", "flown": "fly", "flying": "fly",
        // sing
        "sings": "sing", "sang": "sing", "sung": "sing", "singing": "sing",
        // drink
        "drinks": "drink", "drank": "drink", "drunk": "drink", "drinking": "drink",
        // eat
        "eats": "eat", "ate": "eat", "eaten": "eat", "eating": "eat",
        // sleep
        "sleeps": "sleep", "slept": "sleep", "sleeping": "sleep",
        // wake
        "wakes": "wake", "woke": "wake", "woken": "wake", "waking": "wake",
        // ride
        "rides": "ride", "rode": "ride", "ridden": "ride", "riding": "ride",
        // hide
        "hides": "hide", "hid": "hide", "hidden": "hide", "hiding": "hide",
        // shoot
        "shoots": "shoot", "shot": "shoot", "shooting": "shoot",
        // strike
        "strikes": "strike", "struck": "strike", "stricken": "strike", "striking": "strike",
        // steal
        "steals": "steal", "stole": "steal", "stolen": "steal", "stealing": "steal",
        // kill
        "kills": "kill", "killed": "kill", "killing": "kill",
        // die
        "dies": "die", "died": "die", "dying": "die",
        // live
        "lives": "live", "lived": "live", "living": "live",
        // serve
        "serves": "serve", "served": "serve", "serving": "serve",
        // rule
        "rules": "rule", "ruled": "rule", "ruling": "rule",
        // fight-related
        "slew": "slay", "slain": "slay", "slays": "slay", "slaying": "slay",
        // irregular plurals
        "men": "man", "women": "woman", "children": "child",
        "feet": "foot", "teeth": "tooth", "mice": "mouse",
        "geese": "goose", "oxen": "ox", "people": "person",
        "wolves": "wolf", "knives": "knife", "leaves": "leaf",
        "halves": "half", "lives": "life", "wives": "wife",
        "elves": "elf", "dwarves": "dwarf", "scarves": "scarf",
        // adjective comparatives
        "better": "good", "best": "good",
        "worse": "bad", "worst": "bad",
        "more": "much", "most": "much",
        "less": "little", "least": "little",
        "further": "far", "furthest": "far",
        "older": "old", "elder": "old",
    };

    // ---- Suffix rules ----
    // Applied in order; first match wins.
    // Each rule: [suffix, replacement, minStem] where minStem = min chars before suffix.
    const SUFFIX_RULES = [
        // -ing (present participle)
        // double consonant: running → run
        [/(.{3,})\b([bcdfghjklmnpqrstvwxz])\2ing$/, "$1$2"],
        // -eing → -e: ageing → age (some BrE forms)
        [/(.{2,})eing$/, "$1e"],
        // -ying → -y: dying → die (special: applied via irregular)
        // -ing → -e: loving → love, making → make
        [/(.{3,})ing$/, "$1e", (stem) => /[bcdfghjklmnpqrstvwxz]$/.test(stem) ? null : stem + "e"],
        // -ing → bare stem: talking → talk
        [/(.{3,})ing$/, "$1"],

        // -ed (past tense)
        // double consonant: stopped → stop
        [/(.{3,})([bcdfghjklmnpqrstvwxz])\2ed$/, "$1$2"],
        // -ied → -y: tried → try
        [/(.{3,})ied$/, "$1y"],
        // -ed → -e: loved → love
        [/(.{3,}[aeiou][bcdfghjklmnpqrstvwxz])ed$/, "$1e"],
        // -ed bare: walked → walk
        [/(.{3,})ed$/, "$1"],

        // -s / -es (third person or plural)
        // -ies → -y: flies → fly, tries → try
        [/(.{2,})ies$/, "$1y"],
        // -sses/-ches/-shes/-xes/-zes: watches → watch
        [/(.{2,}(?:ss|ch|sh|x|z))es$/, "$1"],
        // -oes: goes (already handled as irregular), heroes → hero
        [/(.{2,})oes$/, "$1o"],
        // -ves → -f: halves → half (most handled in irregulars)
        [/(.{2,})ves$/, "$1f"],
        // plain -s: runs → run
        [/(.{3,})s$/, "$1"],

        // comparatives / superlatives
        // -ier → -y: happier → happy
        [/(.{2,})ier$/, "$1y"],
        // -iest → -y: happiest → happy
        [/(.{2,})iest$/, "$1y"],
        // double consonant + -er/-est: bigger → big, hottest → hot
        [/(.{2,})([bcdfghjklmnpqrstvwxz])\2er$/, "$1$2"],
        [/(.{2,})([bcdfghjklmnpqrstvwxz])\2est$/, "$1$2"],
        // plain -er, -est: smaller → small, tallest → tall
        [/(.{3,})er$/, "$1"],
        [/(.{3,})est$/, "$1"],
    ];

    function applySuffixRules(word) {
        for (const rule of SUFFIX_RULES) {
            const [pattern, replacement, extra] = rule;
            if (pattern.test(word)) {
                const stem = word.replace(pattern, replacement);
                if (stem && stem.length >= 2 && stem !== word) {
                    if (extra && typeof extra === "function") {
                        const alt = extra(stem);
                        if (alt) return [stem, alt];
                    }
                    return [stem];
                }
            }
        }
        return [];
    }

    /**
     * lemmatize(word) → array of candidate base forms, most likely first.
     * Always includes the original word as the last fallback.
     */
    function lemmatize(word) {
        const lower = word.toLowerCase();

        // 1. Direct irregular lookup
        if (IRREGULARS[lower]) {
            const base = IRREGULARS[lower];
            return base === lower ? [lower] : [base, lower];
        }

        // 2. Suffix rules
        const candidates = applySuffixRules(lower);
        if (candidates.length > 0) {
            // Deduplicate and add original as final fallback
            const seen = new Set(candidates);
            seen.add(lower);
            return [...seen];
        }

        return [lower];
    }

    return { lemmatize };
})();
