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

function setRange(index) {
    const start = index * WORDS_PER_SET;
    return { start, end: start + WORDS_PER_SET };
}

function eligibleWords() {
    // CSV row order defines IDs 1, 2, 3...; disabled rows keep their ID slots.
    return words;
}

function getNewWords() {
    const { start, end } = setRange(currentSetIndex());
    return eligibleWords().slice(start, end).filter(word => truth(word.enabled));
}

function getReviewWords() {
    const { start } = setRange(currentSetIndex());
    const older = eligibleWords().slice(0, start).filter(word => truth(word.enabled));
    return shuffle([...older]).slice(0, WORDS_PER_SET);
}

function show(id) {
    ["home", "game", "complete", "all-words"].forEach(page => {
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
    const { start, end } = setRange(setIndex);
    $("new-set-label").textContent = `Set ${setIndex + 1} · ID ${start + 1}–${end}`;
    $("date-summary").textContent = `Set ${setIndex + 1} · 25 คำ / 10 วัน · คำใหม่ ID ${start + 1}–${end} · ทบทวนจาก ID 1–${start || 0}`;
}

function start(mode) {
    stopSpeech();
    gameMode = mode;
    deck = mode === "review" ? getReviewWords() : getNewWords();
    if (!deck.length) {
        $("home-message").textContent = mode === "review"
            ? "ยังไม่มีคำศัพท์จาก Set ก่อนหน้าให้ทบทวน ♡"
            : "ยังไม่มีคำศัพท์ใน Set ปัจจุบัน ลองเพิ่มคำศัพท์ใน vocabulary.csv ก่อนนะ ♡";
        show("home");
        return;
    }
    $("home-message").textContent = "";
    cursor = 0;
    renderCard();
    show("game");
}

function txt(id, value) { $(id).textContent = value || ""; }

function renderCard() {
    const word = deck[cursor];
    txt("progress-label", `${gameMode === "review" ? "Review" : "New Words"} · ${cursor + 1} / ${deck.length}`);
    $("progress-fill").style.width = `${100 * (cursor + 1) / deck.length}%`;
    const category = categories.find(item => item.id === word.category);
    txt("card-decor", category?.emoji || "☁️");
    txt("card-category", category?.name || word.category);
    txt("word", word.word);
    txt("ipa", word.ipa_us);
    txt("part", word.pos);
    txt("meaning", word.meaning_th);
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
    const { start, end } = setRange(currentSetIndex());
    return words.filter((word, index) => {
        const inSet = wordTableFilter === "all" ||
            (wordTableFilter === "new" && index >= start && index < end) ||
            (wordTableFilter === "old" && index < start);
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
    for (const word of pageWords) {
        const tr = document.createElement("tr");
        for (const value of [word.word, word.pos, word.meaning_th]) {
            const td = document.createElement("td");
            td.textContent = value || "—";
            tr.append(td);
        }
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
    txt("all-count", `พบ ${matches.length} คำ`);
    txt("page-label", `${tablePage + 1} / ${pages}`);
    $("page-prev").disabled = tablePage === 0;
    $("page-next").disabled = tablePage >= pages - 1;
}

async function load() {
    try {
        const response = await fetch("vocabulary.csv", { cache: "no-cache" });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        words = parseCSV(await response.text());
        if (!words.length) throw Error("CSV is empty");
        refreshHome();
    } catch (error) {
        $("home-message").textContent = `อ่าน vocabulary.csv ไม่สำเร็จ: ${error.message} (ต้องเปิดผ่านเว็บเซิร์ฟเวอร์)`;
        ["open-new", "open-review", "open-all"].forEach(id => $(id).disabled = true);
    }
}

$("open-new").addEventListener("click", () => start("new"));
$("open-review").addEventListener("click", () => start("review"));
$("open-all").addEventListener("click", () => { stopSpeech(); tablePage = 0; renderTable(); show("all-words"); });
$("go-home").addEventListener("click", () => { stopSpeech(); refreshHome(); show("home"); });
$("all-home").addEventListener("click", () => { stopSpeech(); refreshHome(); show("home"); });
$("finish-home").addEventListener("click", () => { refreshHome(); show("home"); });
$("restart").addEventListener("click", () => start(gameMode));
$("again").addEventListener("click", () => start(gameMode));
$("next").addEventListener("click", next);
$("reveal").addEventListener("click", () => { $("answer").classList.remove("hidden"); $("reveal").classList.add("hidden"); });
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
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
