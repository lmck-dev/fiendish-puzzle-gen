/* =============================================
   FPG — Layer 2: Semantic Synonym Expansion
   Groups English words by meaning so that a user typing "automobile"
   can match a dictionary that only has "car".
   Organised as semantic clusters — any word in a group can match any other.
   Run scripts/generate_synonyms.py to regenerate from WordNet.
   ============================================= */

window.FPG_Synonyms = (function () {
    "use strict";

    // Each sub-array is a semantic group.
    // Words are lowercase. Order within a group doesn't matter.
    const GROUPS = [
        // ---- Combat / Violence ----
        ["fight", "battle", "combat", "war", "conflict", "clash", "skirmish", "brawl", "duel", "struggle", "contest"],
        ["attack", "assault", "strike", "charge", "raid", "ambush", "assail", "rush", "storm"],
        ["kill", "slay", "murder", "execute", "eliminate", "destroy", "defeat", "vanquish", "annihilate", "slaughter", "massacre", "exterminate"],
        ["die", "perish", "fall", "expire", "succumb", "parish"],
        ["death", "demise", "end", "mortality", "killing", "slaying", "destruction"],
        ["defeat", "conquer", "overcome", "vanquish", "crush", "subdue", "best", "rout"],
        ["victory", "triumph", "win", "conquest", "success"],
        ["weapon", "arm", "armament", "tool"],
        ["sword", "blade", "saber", "sabre", "cutlass", "rapier", "dagger", "knife", "dirk"],
        ["axe", "hatchet", "cleaver", "chopper"],
        ["bow", "crossbow", "longbow"],
        ["arrow", "bolt", "shaft", "projectile"],
        ["spear", "lance", "pike", "javelin", "halberd"],
        ["shield", "buckler", "defence", "defense", "guard"],
        ["armor", "armour", "mail", "plate", "protection"],
        ["helmet", "helm", "headgear"],
        ["battle", "fight", "war", "combat", "skirmish", "conflict", "engagement"],
        ["warrior", "fighter", "soldier", "combatant", "knight", "champion", "hero", "mercenary", "gladiator"],
        ["enemy", "foe", "opponent", "adversary", "rival", "antagonist"],
        ["ally", "friend", "comrade", "companion", "partner", "confederate"],
        ["army", "force", "troops", "legion", "horde", "militia", "host"],
        ["captain", "commander", "leader", "chief", "general", "officer"],
        ["guard", "sentinel", "sentry", "watchman", "protector"],
        ["prisoner", "captive", "hostage", "slave"],
        ["blood", "gore", "wound", "injury"],
        ["wound", "injury", "hurt", "harm", "damage", "cut", "slash"],
        ["pain", "agony", "suffering", "torment", "anguish", "torture"],
        ["strength", "power", "force", "might", "vigour", "vigor"],
        ["courage", "bravery", "valor", "valour", "boldness", "nerve", "daring"],
        ["coward", "cowardice", "fear", "timidity"],

        // ---- Royalty / Hierarchy ----
        ["king", "ruler", "monarch", "sovereign", "lord", "liege"],
        ["queen", "empress", "lady", "mistress"],
        ["emperor", "imperator", "caesar"],
        ["prince", "crown prince", "heir"],
        ["princess", "heir"],
        ["noble", "aristocrat", "lord", "baron", "duke", "earl", "count"],
        ["servant", "slave", "serf", "vassal", "subject", "thrall"],
        ["leader", "chief", "head", "boss", "director", "commander"],
        ["master", "lord", "owner", "ruler", "controller"],
        ["slave", "servant", "thrall", "serf", "bondsman"],

        // ---- People ----
        ["man", "male", "gentleman", "fellow", "guy", "lad"],
        ["woman", "female", "lady", "girl", "maiden", "dame", "lass"],
        ["person", "human", "individual", "being", "mortal", "soul"],
        ["child", "kid", "youth", "youngster", "boy", "girl", "offspring", "son", "daughter"],
        ["elder", "elderly", "old man", "old woman", "senior", "ancient"],
        ["stranger", "outsider", "foreigner", "alien", "newcomer"],
        ["enemy", "foe", "adversary", "opponent", "rival"],
        ["friend", "ally", "comrade", "companion", "mate", "buddy", "pal"],
        ["family", "kin", "clan", "tribe", "house", "lineage"],
        ["father", "dad", "sire", "patriarch"],
        ["mother", "mom", "mum", "matriarch"],
        ["brother", "sibling", "kin"],
        ["sister", "sibling", "kin"],

        // ---- Animals ----
        ["horse", "steed", "mare", "stallion", "pony", "mount", "charger"],
        ["dragon", "wyrm", "wyvern", "drake", "serpent"],
        ["wolf", "canine", "hound", "beast"],
        ["bird", "fowl", "avian"],
        ["eagle", "hawk", "falcon", "raptor"],
        ["dog", "hound", "canine", "cur", "mutt"],
        ["cat", "feline", "kitten"],
        ["snake", "serpent", "viper", "adder"],
        ["bear", "beast"],
        ["lion", "beast", "big cat"],

        // ---- Nature / Environment ----
        ["fire", "flame", "blaze", "inferno", "conflagration", "pyre"],
        ["water", "liquid", "aqua", "drink"],
        ["earth", "ground", "soil", "land", "dirt", "terra"],
        ["wind", "air", "breeze", "gale", "gust", "storm"],
        ["ice", "frost", "snow", "frozen", "cold"],
        ["mountain", "peak", "summit", "hill", "ridge", "highland"],
        ["river", "stream", "brook", "waterway", "creek"],
        ["sea", "ocean", "water", "deep", "abyss"],
        ["sky", "heavens", "heaven", "above", "firmament"],
        ["star", "stars", "celestial", "astral"],
        ["sun", "solar", "daystar", "light"],
        ["moon", "lunar", "moonlight"],
        ["forest", "wood", "woods", "jungle", "grove", "thicket"],
        ["tree", "timber", "wood"],
        ["stone", "rock", "boulder", "pebble"],
        ["shadow", "shade", "darkness", "gloom", "dark"],
        ["light", "illumination", "radiance", "glow", "shine", "brightness"],
        ["darkness", "dark", "night", "shadow", "gloom", "blackness"],
        ["storm", "tempest", "squall", "gale"],

        // ---- Movement / Travel ----
        ["go", "travel", "journey", "move", "proceed", "venture", "trek", "march"],
        ["run", "sprint", "race", "dash", "flee", "bolt", "rush", "hurry", "hasten"],
        ["walk", "stride", "stroll", "march", "pace", "hike", "wander", "roam"],
        ["fly", "soar", "glide", "swoop", "hover"],
        ["swim", "wade", "float", "drift"],
        ["climb", "ascend", "scale", "mount"],
        ["fall", "drop", "descend", "tumble", "plummet"],
        ["follow", "pursue", "chase", "track", "trail", "hunt"],
        ["escape", "flee", "run away", "retreat", "evade", "elude"],
        ["arrive", "come", "reach", "appear", "emerge"],
        ["return", "go back", "come back", "retreat"],
        ["advance", "proceed", "push forward", "move forward", "progress"],
        ["retreat", "withdraw", "pull back", "fall back", "flee"],

        // ---- Emotions / States ----
        ["love", "adore", "cherish", "affection", "devotion", "fondness", "worship"],
        ["hate", "despise", "detest", "loathe", "abhor", "dislike"],
        ["fear", "terror", "dread", "fright", "horror", "panic", "alarm"],
        ["anger", "rage", "fury", "wrath", "ire", "indignation"],
        ["joy", "happiness", "delight", "gladness", "elation", "bliss", "pleasure"],
        ["sadness", "grief", "sorrow", "mourning", "despair", "melancholy", "misery"],
        ["pride", "honour", "honor", "dignity", "glory", "prestige"],
        ["shame", "dishonour", "dishonor", "disgrace", "humiliation"],
        ["hope", "wish", "aspiration", "desire", "longing"],
        ["despair", "hopelessness", "anguish", "misery"],
        ["trust", "faith", "belief", "confidence", "loyalty"],
        ["doubt", "distrust", "suspicion", "mistrust", "scepticism", "skepticism"],
        ["curiosity", "wonder", "awe", "amazement", "astonishment"],
        ["hunger", "thirst", "craving", "desire", "need", "want"],

        // ---- Communication / Speech ----
        ["say", "speak", "talk", "tell", "utter", "declare", "state", "announce"],
        ["ask", "question", "inquire", "request", "beg", "implore", "query"],
        ["command", "order", "demand", "instruct", "direct", "decree"],
        ["shout", "yell", "cry", "scream", "roar", "bellow", "howl"],
        ["whisper", "murmur", "mutter", "breathe"],
        ["lie", "deceive", "mislead", "trick", "betray", "cheat"],
        ["truth", "fact", "reality", "honesty"],
        ["secret", "mystery", "hidden", "concealed"],
        ["language", "tongue", "speech", "words", "dialect"],
        ["name", "title", "designation", "label"],

        // ---- Objects / Things ----
        ["ship", "vessel", "craft", "boat", "galley", "warship"],
        ["car", "automobile", "vehicle", "auto", "motor", "carriage"],
        ["house", "home", "dwelling", "abode", "residence", "shelter", "domicile"],
        ["city", "town", "settlement", "metropolis", "capital"],
        ["door", "gate", "entrance", "portal", "gateway"],
        ["food", "meal", "sustenance", "nourishment", "provisions", "rations", "feast"],
        ["drink", "beverage", "liquid", "potion", "ale", "wine", "water"],
        ["gold", "wealth", "treasure", "riches", "fortune", "spoils"],
        ["fire", "flame", "blaze"],
        ["map", "chart", "plan", "guide"],
        ["key", "clue", "answer", "solution", "secret"],
        ["book", "tome", "scroll", "text", "manuscript"],
        ["song", "melody", "chant", "hymn", "ballad"],
        ["crown", "diadem", "circlet", "tiara"],
        ["throne", "seat", "reign", "rule"],
        ["flag", "banner", "standard", "ensign"],
        ["gift", "offering", "tribute", "present"],
        ["poison", "venom", "toxin", "bane"],
        ["treasure", "hoard", "riches", "wealth", "spoils", "loot"],
        ["prison", "dungeon", "cell", "gaol", "jail", "cage"],
        ["spell", "curse", "hex", "enchantment", "charm", "incantation", "magic"],
        ["potion", "elixir", "brew", "concoction", "draught"],

        // ---- Abstract / Concepts ----
        ["power", "strength", "force", "might", "authority", "dominion", "control"],
        ["magic", "sorcery", "witchcraft", "wizardry", "spell", "enchantment", "mysticism"],
        ["destiny", "fate", "doom", "fortune", "wyrd"],
        ["time", "age", "era", "epoch", "period", "moment"],
        ["world", "realm", "land", "domain", "dimension", "universe", "cosmos"],
        ["life", "existence", "being", "living"],
        ["death", "end", "demise", "mortality", "doom"],
        ["beginning", "start", "origin", "dawn", "birth"],
        ["end", "finish", "conclusion", "death", "doom", "termination"],
        ["truth", "fact", "reality", "verity"],
        ["lie", "falsehood", "deception", "untruth"],
        ["law", "rule", "code", "decree", "edict", "ordinance"],
        ["justice", "fairness", "righteousness", "equity"],
        ["mercy", "compassion", "kindness", "clemency", "grace"],
        ["wisdom", "knowledge", "lore", "intelligence", "understanding", "insight"],
        ["ignorance", "stupidity", "foolishness", "folly"],
        ["freedom", "liberty", "independence"],
        ["slavery", "bondage", "captivity", "servitude"],
        ["good", "righteous", "virtuous", "noble", "honourable", "honorable"],
        ["evil", "wicked", "corrupt", "sinister", "vile", "malevolent", "dark"],
        ["ancient", "old", "elder", "primordial", "archaic", "eternal"],
        ["new", "young", "fresh", "recent", "modern"],
        ["great", "mighty", "powerful", "supreme", "grand", "exalted"],
        ["small", "little", "tiny", "minor", "petty"],
        ["holy", "sacred", "divine", "blessed", "hallowed"],
        ["cursed", "damned", "wretched", "accursed"],
        ["danger", "threat", "peril", "hazard", "risk"],
        ["safety", "sanctuary", "refuge", "shelter", "haven"],
        ["home", "hearth", "haven", "refuge", "dwelling", "abode"],
        ["journey", "quest", "mission", "expedition", "voyage", "pilgrimage"],
        ["secret", "mystery", "enigma", "riddle", "puzzle"],
        ["honour", "honor", "glory", "prestige", "renown", "fame", "reputation"],
        ["shame", "dishonour", "disgrace", "ignominy"],
        ["promise", "oath", "vow", "pledge", "swear"],
        ["betrayal", "treachery", "treason", "deceit"],

        // ---- Body / Physical ----
        ["hand", "fist", "palm", "grip", "grasp"],
        ["eye", "sight", "vision", "gaze"],
        ["heart", "soul", "spirit", "core", "essence"],
        ["mind", "thought", "intelligence", "brain", "reason", "wit"],
        ["body", "flesh", "form", "figure", "physical"],
        ["head", "skull", "mind", "crown"],

        // ---- Time ----
        ["now", "today", "present", "currently", "immediately"],
        ["past", "before", "former", "previous", "ago", "yesterday", "ancient"],
        ["future", "tomorrow", "later", "soon", "next", "forthcoming"],
        ["always", "forever", "eternal", "evermore", "ever"],
        ["never", "not ever"],
        ["day", "daytime", "daylight", "sun"],
        ["night", "darkness", "dark", "evening", "dusk", "nightfall"],

        // ---- Direction / Position ----
        ["north", "northern", "arctic", "boreal"],
        ["south", "southern", "austral"],
        ["east", "eastern", "orient"],
        ["west", "western", "occident"],
        ["above", "over", "high", "up", "aloft", "overhead"],
        ["below", "under", "beneath", "low", "underneath"],
        ["inside", "within", "in", "interior", "inner"],
        ["outside", "without", "out", "exterior", "outer"],
        ["near", "close", "nearby", "adjacent"],
        ["far", "distant", "remote", "afar"],

        // ---- Supernatural / Magic ----
        ["spirit", "ghost", "soul", "shade", "spectre", "specter", "phantom", "wraith"],
        ["demon", "devil", "fiend", "daemon", "evil spirit"],
        ["god", "deity", "divine", "immortal", "divine being"],
        ["angel", "divine messenger", "holy being"],
        ["undead", "revenant", "zombie", "skeleton", "lich", "wight"],
        ["curse", "hex", "bane", "doom", "malediction", "jinx"],
        ["vision", "prophecy", "omen", "portent", "sign", "augury"],
        ["power", "magic", "ability", "gift", "talent"],
    ];

    // ---- Build lookup map: word → group index ----
    const wordToGroup = new Map();
    GROUPS.forEach((group, idx) => {
        group.forEach(word => {
            // A word may appear in multiple groups; store all
            if (!wordToGroup.has(word)) wordToGroup.set(word, []);
            wordToGroup.get(word).push(idx);
        });
    });

    /**
     * Given a word and a set of dictionary keys (Set or object),
     * returns the first dictionary key that shares a semantic group with the word,
     * or null if none found.
     */
    function findMatch(word, dictKeys) {
        const lower = word.toLowerCase();
        const groupIndices = wordToGroup.get(lower);
        if (!groupIndices) return null;

        for (const idx of groupIndices) {
            for (const groupWord of GROUPS[idx]) {
                if (groupWord !== lower && (dictKeys instanceof Set ? dictKeys.has(groupWord) : groupWord in dictKeys)) {
                    return groupWord;
                }
            }
        }
        return null;
    }

    /**
     * Returns all words in the same semantic group(s) as the given word.
     */
    function getSynonyms(word) {
        const lower = word.toLowerCase();
        const groupIndices = wordToGroup.get(lower);
        if (!groupIndices) return [];
        const result = new Set();
        for (const idx of groupIndices) {
            GROUPS[idx].forEach(w => { if (w !== lower) result.add(w); });
        }
        return [...result];
    }

    return { findMatch, getSynonyms, GROUPS };
})();
