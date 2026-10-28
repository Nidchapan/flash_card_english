"use strict";

// Permanent learning calendar. Change manually only when you want a new schedule.
const START_DATE = "2026-10-24";
const DAYS_PER_SET = 10;
const WORDS_PER_SET = 25;
const TABLE_PAGE_SIZE = 50;
const $ = id => document.getElementById(id);

const categories = [
    { id: "General & Daily Life", name: "General & Daily Life", emoji: "🌎" },
    { id: "People & Society", name: "People & Society", emoji: "🧠" },
    { id: "Action & Adventure", name: "Action & Adventure", emoji: "⚔️" },
    { id: "Science & Nature", name: "Science & Nature", emoji: "🔬" },
    { id: "World & Civilization", name: "World & Civilization", emoji: "🏛️" },
    { id: "Fantasy & Mystery", name: "Fantasy & Mystery", emoji: "✨" }
];

let words = [];
let deck = [];
let cursor = 0;
let gameMode = "new";
let selectedMode = "new";
let selectedCount = "25";
let selectedDirection = "mixed";
let cardDirections = [];
let scheduledWords = [];
let tablePage = 0;
let wordTableFilter = "all";
const norm = value => String(value ?? "").trim();
const truth = value => ["true", "1", "yes", "y"].includes(norm(value).toLowerCase());

function parseCSV(source) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (char === '"') {
            if (quoted && source[i + 1] === '"') { field += '"'; i++; }
            else quoted = !quoted;
        } else if (char === "," && !quoted) {
            row.push(field); field = "";
        } else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && source[i + 1] === "\n") i++;
            row.push(field);
            if (row.some(value => value.trim())) rows.push(row);
            row = []; field = "";
        } else field += char;
    }
    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);
    const headers = (rows.shift() || []).map(value => value.replace(/^\uFEFF/, "").trim());
    return rows.map(values => Object.fromEntries(headers.map((key, i) => [key, norm(values[i])])));
}

function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

function currentSetIndex(date = new Date()) {
    // Compare local calendar dates as UTC day numbers, avoiding DST/time-of-day drift.
    const todayDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const startDay = Date.UTC(2026, 9, 24);
    return Math.max(0, Math.floor((todayDay - startDay) / 86400000 / DAYS_PER_SET));
}

// The CSV is the sole source of truth. No browser persistence.
const learningState = word => truth(word.known) ? "known" : "learning";

// Preserve CSV row order within each category; interleave categories fairly.
function orderedLearningWords() {
    const available = words.filter(w => truth(w.enabled));
    const buckets = categories.map(cat => available.filter(w => w.category === cat.id));
    const other = available.filter(w => !categories.some(cat => cat.id === w.category));
    if (other.length) buckets.push(other);
    const ordered = [];
    let remaining = true;
    while (remaining) {
        remaining = false;
        for (const bucket of buckets) {
            if (bucket.length) { ordered.push(bucket.shift()); remaining = true; }
        }
    }
    return ordered;
}

function getWordSchedule() {
    // Dynamic queue: filter known FIRST, then partition by 10-day sets.
    // Every enabled unknown word is in exactly one of: Review, New, Upcoming.
    const ordered = scheduledWords.filter(w => !truth(w.known));
    const index = currentSetIndex();
    const start = index * WORDS_PER_SET;
    const end = start + WORDS_PER_SET;
    return {
        ordered, current: ordered.slice(start, end), older: ordered.slice(0, start),
        upcoming: ordered.slice(end), start, end
    };
}

function getNewWords() { return shuffle([...getWordSchedule().current]); }
function getReviewWords(count = 25) {
    const older = shuffle([...getWordSchedule().older]);
    return count === "all" ? older : older.slice(0, Number(count));
}
function getKnownWords(count = 25) {
    const known = shuffle(words.filter(w => truth(w.enabled) && truth(w.known)));
    return count === "all" ? known : known.slice(0, Number(count));
}

function show(id) {
    ["home", "setup", "game", "complete", "all-words"].forEach(page => {
        $(page).classList.toggle("hidden", page !== id);
    });
    window.scrollTo({ top: 0, behavior: "instant" });
}

function stopSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function speakText(text) {
    if (!text) return;
    if (!("speechSynthesis" in window)) {
        alert("อุปกรณ์นี้ไม่รองรับเสียงอ่านผ่าน Browser");
        return;
    }
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase() === "en-us");
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
}

function refreshHome() {
    const setIndex = currentSetIndex();
    const { current, older, upcoming } = getWordSchedule();
    $("new-set-label").textContent = `Set ${setIndex + 1} · ${current.length}/25 คำ · 10 วัน`;
    $("date-summary").textContent = `Set ${setIndex + 1} · New ${current.length} คำ · Review ${older.length} คำ · รอเรียน ${upcoming.length} คำ · เริ่ม 24 Oct 2026`;
}

function openSetup(mode) {
    stopSpeech();
    selectedMode = mode;
    selectedCount = "25";
    selectedDirection = "mixed";
    $("setup-title").textContent = mode === "new" ? "📖 New Words" : mode === "review" ? "🔁 Review" : "⭐ Practice Known";
    $("setup-count-wrap").classList.toggle("hidden", mode === "new");
    $("setup-description").textContent = mode === "new"
        ? "25 คำที่ยังจำไม่ได้ใน Set ปัจจุบัน (อาจน้อยลงเมื่อคำศัพท์ใกล้หมด)"
        : mode === "review" ? "สุ่มคำที่ยังจำไม่ได้จาก Set ก่อนหน้า" : "สุ่มคำที่ทำเครื่องหมาย known = TRUE";
    updateSetupButtons();
    show("setup");
}

function updateSetupButtons() {
    document.querySelectorAll("[data-count]").forEach(button => {
        const active = button.dataset.count === selectedCount;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-direction]").forEach(button => {
        const active = button.dataset.direction === selectedDirection;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
}

function start(mode = selectedMode) {
    stopSpeech();
    gameMode = mode;
    deck = mode === "review" ? getReviewWords(selectedCount)
        : mode === "known" ? getKnownWords(selectedCount) : getNewWords();
    if (!deck.length) {
        $("home-message").textContent = mode === "known"
            ? "ยังไม่มีคำศัพท์ที่ทำเครื่องหมายว่าจำได้ ♡"
            : mode === "review" ? "ยังไม่มีคำศัพท์เก่าที่ต้องทบทวน ♡"
            : "ไม่มีคำศัพท์ที่ต้องเรียนใน Set นี้แล้ว ♡";
        show("home");
        return;
    }
    // Mixed is balanced per session, but randomly assigned per card.
    cardDirections = selectedDirection === "mixed"
        ? shuffle(deck.map((_, i) => i % 2 === 0 ? "en" : "th"))
        : deck.map(() => selectedDirection);
    $("home-message").textContent = "";
    cursor = 0;
    show("game");
    renderCard();
}

function txt(id, value) { $(id).textContent = value || ""; }

function renderCard() {
    const word = deck[cursor];
    $("card-memory").textContent = learningState(word) === "known" ? "✓ จำได้" : "↻ ยังจำไม่ได้";
    txt("progress-label", `${gameMode === "review" ? "Review" : gameMode === "known" ? "Practice Known" : "New Words"} · ${cursor + 1} / ${deck.length}`);
    $("progress-fill").style.width = `${100 * (cursor + 1) / deck.length}%`;
    const category = categories.find(item => item.id === word.category);
    txt("card-decor", category?.emoji || "☁️");
    txt("card-category", category?.name || word.category);
    const thaiFirst = cardDirections[cursor] === "th";
    txt("word", thaiFirst ? word.meaning_th : word.word);
    txt("ipa", thaiFirst ? "" : word.ipa_us);
    txt("part", thaiFirst ? "" : word.pos);
    txt("meaning", thaiFirst ? word.word : word.meaning_th);
    txt("answer-divider", thaiFirst ? "✧ English answer ✧" : "✧ meaning ✧");
    $("speak").classList.toggle("hidden", thaiFirst);
    $("card-direction").textContent = thaiFirst ? "ไทย → อังกฤษ" : "English → Thai";
    $("answer").classList.add("hidden");
    $("reveal").classList.remove("hidden");

    const forms = [word.v1, word.v2, word.v3, word.future];
    $("verb-forms").classList.toggle("hidden", !forms.some(Boolean));
    txt("verb-forms", forms.some(Boolean)
        ? `V1: ${word.v1 || "—"} · V2: ${word.v2 || "—"} · V3: ${word.v3 || "—"} · Future: ${word.future || "—"}`
        : "");

    $("examples").replaceChildren();
    for (let i = 1; i <= 3; i++) {
        const english = word[`example_${i}`];
        if (!english) continue;
        const box = document.createElement("div");
        box.className = "example";
        const line = document.createElement("div");
        line.className = "example-line";
        const sentence = document.createElement("strong");
        sentence.textContent = `${i}. ${english}`;
        const audio = document.createElement("button");
        audio.className = "example-sound";
        audio.type = "button";
        audio.textContent = "🔊";
        audio.title = `ฟังประโยคตัวอย่างที่ ${i}`;
        audio.setAttribute("aria-label", `ฟังประโยคตัวอย่างที่ ${i}`);
        audio.addEventListener("click", () => speakText(english));
        line.append(sentence, audio);
        const translation = document.createElement("p");
        translation.textContent = word[`example_${i}_th`] || "";
        box.append(line, translation);
        $("examples").append(box);
    }
    txt("next", cursor === deck.length - 1 ? "Finish round ✨" : "Next word ➜");
    if (!thaiFirst) speakText(word.word);
}

function revealAnswer() {
    if (!$("answer").classList.contains("hidden")) return;
    $("answer").classList.remove("hidden");
    $("reveal").classList.add("hidden");
    if (cardDirections[cursor] === "th") {
        txt("ipa", deck[cursor].ipa_us);
        txt("part", deck[cursor].pos);
        $("speak").classList.remove("hidden");
        speakText(deck[cursor].word);
    }
}

function next() {
    stopSpeech();
    if (cursor + 1 >= deck.length) {
        txt("finish-text", `คุณเรียนครบ ${deck.length} คำแล้ว! กลับมาทบทวนได้ทุกเมื่อ ♡`);
        show("complete");
    } else {
        cursor++;
        renderCard();
    }
}

function getFilteredWords() {
    const search = $("word-search").value.trim().toLocaleLowerCase();
    const schedule = getWordSchedule();
    const newRows = new Set(schedule.current.map(w => w.rowNumber));
    const oldRows = new Set(schedule.older.map(w => w.rowNumber));
    return words.filter(word => {
        const inSet = wordTableFilter === "all" ||
            (wordTableFilter === "known" && learningState(word) === "known") ||
            (wordTableFilter === "learning" && learningState(word) === "learning") ||
            (wordTableFilter === "new" && newRows.has(word.rowNumber)) ||
            (wordTableFilter === "old" && oldRows.has(word.rowNumber));
        return inSet && truth(word.enabled) &&
            [word.word, word.pos, word.meaning_th].some(value => norm(value).toLocaleLowerCase().includes(search));
    });
}

function renderTable() {
    const matches = getFilteredWords();
    const pages = Math.max(1, Math.ceil(matches.length / TABLE_PAGE_SIZE));
    tablePage = Math.min(tablePage, pages - 1);
    const pageWords = matches.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);
    const body = $("word-rows");
    body.replaceChildren();
    const schedule = getWordSchedule();
    const newRows = new Set(schedule.current.map(w => w.rowNumber));
    const oldRows = new Set(schedule.older.map(w => w.rowNumber));
    for (const word of pageWords) {
        const tr = document.createElement("tr");
        for (const value of [word.word, word.pos, word.meaning_th]) {
            const td = document.createElement("td");
            td.textContent = value || "—";
            tr.append(td);
        }
        const statusCell = document.createElement("td");
        const status = document.createElement("span");
        const isNew = newRows.has(word.rowNumber);
        const isOld = oldRows.has(word.rowNumber);
        status.className = `word-status ${isNew ? "status-new" : isOld ? "status-old" : "status-upcoming"}`;
        status.textContent = isNew ? "🌱 New" : isOld ? "🔁 Old" : "🔒 Upcoming";
        statusCell.append(status);
        tr.append(statusCell);
        const memoryCell = document.createElement("td");
        const memoryBadge = document.createElement("span");
        memoryBadge.className = `memory-select ${learningState(word) === "known" ? "memory-known" : "memory-learning"}`;
        memoryBadge.textContent = learningState(word) === "known" ? "✓ จำได้" : "↻ ยังจำไม่ได้";
        memoryCell.append(memoryBadge);
        tr.append(memoryCell);
        const soundCell = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "table-sound";
        button.textContent = "🔊";
        button.setAttribute("aria-label", `ฟังคำว่า ${word.word}`);
        button.addEventListener("click", () => speakText(word.word));
        soundCell.append(button);
        tr.append(soundCell);
        body.append(tr);
    }
    txt("all-count", `พบ ${matches.length} คำ · จำได้ ${words.filter(w => learningState(w) === "known").length} · ยังจำไม่ได้ ${words.filter(w => learningState(w) === "learning").length}`);
    txt("page-label", `${tablePage + 1} / ${pages}`);
    $("page-prev").disabled = tablePage === 0;
    $("page-next").disabled = tablePage >= pages - 1;
}

async function load() {
    try {
        const response = await fetch("vocabulary.csv", { cache: "no-cache" });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        words = parseCSV(await response.text()).map((word, index) => ({ ...word, rowNumber: index + 1 }));
        if (!words.length) throw Error("CSV is empty");
        if (!("known" in words[0])) throw Error("ไม่พบคอลัมน์ known ใน vocabulary.csv");
        const ids = words.map(w => w.id).filter(Boolean);
        if (new Set(ids).size !== ids.length) throw Error("พบ id ซ้ำใน vocabulary.csv");
        scheduledWords = orderedLearningWords();
        refreshHome();
    } catch (error) {
        $("home-message").textContent = `อ่าน vocabulary.csv ไม่สำเร็จ: ${error.message} (ต้องเปิดผ่านเว็บเซิร์ฟเวอร์)`;
        ["open-new", "open-review", "open-known", "open-all"].forEach(id => $(id).disabled = true);
    }
}

$("open-new").addEventListener("click", () => openSetup("new"));
$("open-review").addEventListener("click", () => openSetup("review"));
$("open-known").addEventListener("click", () => openSetup("known"));
$("setup-home").addEventListener("click", () => show("home"));
$("setup-start").addEventListener("click", () => start(selectedMode));
$("setup-counts").addEventListener("click", event => {
    const button = event.target.closest("[data-count]");
    if (!button) return;
    selectedCount = button.dataset.count;
    updateSetupButtons();
});
$("setup-directions").addEventListener("click", event => {
    const button = event.target.closest("[data-direction]");
    if (!button) return;
    selectedDirection = button.dataset.direction;
    updateSetupButtons();
});
$("open-all").addEventListener("click", () => { stopSpeech(); tablePage = 0; renderTable(); show("all-words"); });
$("go-home").addEventListener("click", () => { stopSpeech(); refreshHome(); show("home"); });
$("all-home").addEventListener("click", () => { stopSpeech(); refreshHome(); show("home"); });
$("finish-home").addEventListener("click", () => { refreshHome(); show("home"); });
$("restart").addEventListener("click", () => start(gameMode));
$("again").addEventListener("click", () => start(gameMode));
$("next").addEventListener("click", next);

// Desktop keyboard shortcuts, active only during flashcard practice.
document.addEventListener("keydown", event => {
    if ($("game").classList.contains("hidden")) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;

    if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
    } else if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        revealAnswer();
    }
});
$("reveal").addEventListener("click", revealAnswer);
$("speak").addEventListener("click", () => speakText(deck[cursor]?.word));
$("word-filter").addEventListener("click", event => {
    const button = event.target.closest("[data-word-filter]");
    if (!button) return;
    wordTableFilter = button.dataset.wordFilter;
    $("word-filter").querySelectorAll("[data-word-filter]").forEach(item => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
    });
    tablePage = 0;
    renderTable();
});
$("word-search").addEventListener("input", () => { tablePage = 0; renderTable(); });
$("page-prev").addEventListener("click", () => { tablePage--; renderTable(); });
$("page-next").addEventListener("click", () => { tablePage++; renderTable(); });

refreshHome();
load();
// v18: No app-managed persistent storage. Unregister older workers and
// delete only caches belonging to Cloud Candy (never other projects).
if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            const scope = new URL("./", location.href).href;
            await Promise.all(registrations.filter(r => r.scope === scope).map(r => r.unregister()));
            if ("caches" in window) {
                const keys = await caches.keys();
                await Promise.all(keys.filter(k => k.startsWith("cloud-candy-vocab-")).map(k => caches.delete(k)));
            }
        } catch (error) { console.warn("Legacy cache cleanup:", error); }
    });
}
