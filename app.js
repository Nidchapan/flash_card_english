"use strict";
const $ = id => document.getElementById(id);
const categories = [
{
"id": "General & Daily Life",
"name": "General & Daily Life",
"th": "ชีวิตประจำวัน",
"emoji": "🌎",
"style": "cat-general"
},
{
"id": "People & Society",
"name": "People & Society",
"th": "ผู้คนและสังคม",
"emoji": "🧠",
"style": "cat-people"
},
{
"id": "Action & Adventure",
"name": "Action & Adventure",
"th": "ผจญภัยและการเอาตัวรอด",
"emoji": "⚔️",
"style": "cat-action"
},
{
"id": "Science & Nature",
"name": "Science & Nature",
"th": "วิทยาศาสตร์และธรรมชาติ",
"emoji": "🔬",
"style": "cat-science"
},
{
"id": "World & Civilization",
"name": "World & Civilization",
"th": "โลกและอารยธรรม",
"emoji": "🏛️",
"style": "cat-world"
},
{
"id": "Fantasy & Mystery",
"name": "Fantasy & Mystery",
"th": "แฟนตาซีและปริศนา",
"emoji": "✨",
"style": "cat-fantasy"
},
{
"id": "all",
"name": "All Categories",
"th": "ทุกหมวด",
"emoji": "🌈",
"style": "cat-all"
}
];
let words = [], selectedCategory = "all", selectedCount = 10, selectedFilter = "unknown", deck = [], cursor = 0;
const norm=v=>String(v??"").trim(),truth=v=>["true","1","yes","y"].includes(norm(v).toLowerCase());
function parseCSV(s) {
    const out=[];
    let row=[],field="",quoted=false;
    for(let i=0;i<s.length;i++) {
        const c=s[i];
        if(c==='"') {
            if(quoted&&s[i+1]==='"') {
                field+='"';
                i++
            }
            else quoted=!quoted
        }
        else if(c===","&&!quoted) {
            row.push(field);
            field=""
        }
        else if((c==="\n"||c==="\r")&&!quoted) {
            if(c==="\r"&&s[i+1]==="\n")i++;
            row.push(field);
            if(row.some(v=>v.trim()))out.push(row);
            row=[];
            field=""
        }
        else field+=c
    }
    row.push(field);
    if(row.some(v=>v.trim()))out.push(row);
    const heads=(out.shift()||[]).map(v=>v.replace(/^\uFEFF/,"").trim());
    return out.map(r=>Object.fromEntries(heads.map((h,i)=>[h,norm(r[i])])));
}
function shuffle(a) {
    for(let i=a.length-1;i>0;i--) {
        const j=Math.floor(Math.random()*(i+1));
        [a[i],a[j]]=[a[j],a[i]]
    }
    return a
}
function show(id) {
    ["home","game","complete"].forEach(p=>$(p).classList.toggle("hidden",p!==id));
    window.scrollTo({top:0,behavior:"instant"})
}
function renderCategories()  {
    $("categories").innerHTML = categories.map(c => `
        <button class="category ${c.style} ${c.id === selectedCategory ? "selected" : ""}"
                data-category="${c.id}" aria-pressed="${c.id === selectedCategory}">
            <span class="tick">✓</span>
            <span class="emoji">${c.emoji}</span>
            <span class="cat-name">${c.name}</span>
            <span class="cat-sub">${c.th}</span>
        </button>
    `).join("");
    document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
    selectedCategory = button.dataset.category;
    renderCategories();
    });
    });
}
function chooseButtons(parent,attr,callback) {
    $(parent).addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;callback(b.dataset[attr]);$(parent).querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b))})
}
function start() {
    const eligible=words.filter(w=>truth(w.enabled)&&(selectedCategory==="all"||w.category===selectedCategory)&&(selectedFilter==="all"||(truth(w.known)===(selectedFilter==="known"))));
    if(!eligible.length) {
        $("home-message").textContent="ยังไม่มีคำศัพท์ที่ตรงกับเงื่อนไขนี้ ลองเปลี่ยนหมวดหรือสถานะนะ ♡";
        return
    }
    deck=shuffle([...eligible]).slice(0,selectedCount);
    cursor=0;
    $("home-message").textContent="";
    renderCard();
    show("game")
}
function txt(id,v) {
    $(id).textContent=v||""
}
function renderCard() {
    const w=deck[cursor];
    txt("progress-label",`${cursor+1} / ${deck.length}`);
    $("progress-fill").style.width=`${100*(cursor+1)/deck.length}%`;
    const c=categories.find(x=>x.id===w.category);
    txt("card-decor",c?.emoji||"☁️");
    txt("card-category",c?.name||w.category);
    txt("word",w.word);
    txt("ipa",w.ipa_us);
    txt("part",w.pos);
    txt("meaning",w.meaning_th);
    $("answer").classList.add("hidden");
    $("reveal").classList.remove("hidden");
    const forms=[w.v1,w.v2,w.v3,w.future];
    $("verb-forms").classList.toggle("hidden",!forms.some(Boolean));
    txt("verb-forms",forms.some(Boolean)?`V1: ${w.v1||"—"}  ·  V2: ${w.v2||"—"}  ·  V3: ${w.v3||"—"}  ·  Future: ${w.future||"—"}`:"");
    $("examples").replaceChildren();
    for(let i=1;i<=3;i++) {
        const en=w[`example_${i}`],th=w[`example_${i}_th`];
        if(!en)continue;
        const box=document.createElement("div");
        box.className="example";
        const strong=document.createElement("strong");
        strong.textContent=`${i}. ${en}`;
        const p=document.createElement("p");
        p.textContent=th||"";
        box.append(strong,p);
        $("examples").append(box)
    }
    txt("next",cursor===deck.length-1?"Finish round ✨":"Next word ➜")
}
function next() {
    if(cursor+1>=deck.length) {
        txt("finish-text",`คุณทบทวนครบ ${deck.length} คำแล้ว! อย่าลืมกลับไปอัปเดต known ใน CSV เมื่อพร้อมนะ ♡`);
        show("complete")
    }
    else {
        cursor++;
        renderCard()
    }
}
function speak() {
    const w=deck[cursor];
    if(!("speechSynthesis" in window)) {
        alert("อุปกรณ์นี้ไม่รองรับเสียงอ่านผ่าน Browser");
        return
    }
    window.speechSynthesis.cancel();
    const utter=new SpeechSynthesisUtterance(w.word);
    utter.lang="en-US";
    utter.rate=.85;
    const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase()==="en-us");
    if(voice)utter.voice=voice;
    window.speechSynthesis.speak(utter)
}
async function load() {
    try {
        const response=await fetch("vocabulary.csv",{cache:"no-cache"});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        words=parseCSV(await response.text());
        if(!words.length)throw Error("CSV is empty");
    }
    catch(err) {
        $("home-message").textContent="อ่าน vocabulary.csv ไม่สำเร็จ: "+err.message+" (ต้องเปิดผ่านเว็บเซิร์ฟเวอร์ ไม่ใช่ file://)";
        $("start").disabled=true
    }
}
renderCategories();
chooseButtons("counts","count",v=>selectedCount=Number(v));
chooseButtons("filters","filter",v=>selectedFilter=v);
$("start").addEventListener("click",start);
$("go-home").addEventListener("click",()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel();show("home")});
$("finish-home").addEventListener("click",()=>show("home"));
$("restart").addEventListener("click",()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel();start()});
$("again").addEventListener("click",start);
$("next").addEventListener("click",next);
$("reveal").addEventListener("click",()=>{$("answer").classList.remove("hidden");$("reveal").classList.add("hidden")});
$("speak").addEventListener("click",speak);
load();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
