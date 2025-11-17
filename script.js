// script.js – Version 100% fonctionnelle pour ton index.html
const newsContainer = document.getElementById("news");
const circle = document.getElementById("sentiment-circle");
const sentimentText = document.getElementById("sentiment-text");

const STORAGE_KEY = "sentimentNews_v5";
const DAY_KEY = "lastDay_v5";

if (localStorage.getItem(DAY_KEY) !== new Date().toLocaleDateString("fr-FR")) {
    localStorage.setItem(STORAGE_KEY, "[]");
    localStorage.setItem(DAY_KEY, new Date().toLocaleDateString("fr-FR"));
}

const keywords = {
    "-10": [/vix.?spike.{0,15}(3|4|5)\d/i, /circuit.?breaker/i, /trading.?halted/i],
    "-8": [/crash|plunge|meltdown|capitulation|liquidation.?cascade/i],
    "-6": [/bank.?run|default|systemic|contagion/i],
    "-4": [/hard.?landing|recession.?confirmed|government.?shutdown/i],
    "-3": [/war|missile|nuke|escalation|hawkish.?surprise|hike.?75|hike.?100/i],
    "+8": [/emergency.?cut|rate.?cut.?(75|100)/i, /qe/i],
    "+6": [/melt.?up|euphoria|fomo|parabolic/i],
    "+3": [/dovish.?surprise|fed.?pivot|stimulus/i],
    "-2": [/hot.?cpi|sticky.?inflation/i],
    "+2": [/cool.?cpi|disinflation|soft.?landing/i],
    "-1": [/risk.?off|safe.?haven/i],
    "+1": [/risk.?on|vix.?crush|beat.?estimates/i]
};

const marketFilter = /stock|dow|nasdaq|s&p|spx|fed|rate|cpi|ppi|powell|vix|volatility|yield|treasury|fomc/i;

const sources = [
    "https://feeds.feedburner.com/zerohedge",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://seekingalpha.com/api/v3/news/rss?limit=50",
    "https://news.google.com/rss/search?q=when:1h+(vix+OR+spx+OR+fed+OR+powell)&hl=en-US&gl=US&ceid=US:en"
];

let rollingScore = 0;

async function fetchRSS(url) {
    try {
        const r = await fetch("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(url), {cache:"no-store"});
        if (!r.ok) return [];
        const d = await r.json();
        return d.items || [];
    } catch (e) { console.warn("RSS fail", url); return []; }
}

async function update() {
    let rawScore = 0;
    let newItems = [];

    for (const url of sources) {
        const items = await fetchRSS(url);
        for (const item of items) {
            const title = (item.title || "").trim();
            const desc = (item.description || "").replace(/<[^>]+>/g, " ").trim();
            const full = (title + " " + desc).toLowerCase();
            if (!marketFilter.test(full)) continue;

            let score = 0;
            for (const [w, patterns] of Object.entries(keywords)) {
                for (const p of patterns) if (p.test(full)) score += parseInt(w);
            }
            if (/breaking|urgent|flash|live/i.test(title)) score += score < 0 ? -3 : +3;

            const ageMin = (Date.now() - Date.parse(item.pubDate || Date.now())) / 60000;
            const decay = ageMin < 20 ? 1 : ageMin < 60 ? 0.7 : ageMin < 180 ? 0.4 : 0.1;
            rawScore += score * decay;

            newItems.push({ title, score: score * decay, pubDate: item.pubDate });
        }
    }

    rollingScore = rollingScore === 0 ? rawScore : rollingScore * 0.75 + rawScore * 0.25;

    let stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    for (const n of newItems) {
        if (!stored.some(s => s.title === n.title)) stored.push(n);
    }
    stored.sort((a, b) => (b.pubDate ? new Date(b.pubDate) : 0) - (a.pubDate ? new Date(a.pubDate) : 0));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.slice(0, 300)));

    newsContainer.innerHTML = stored.slice(0, 40).map(n => {
        const d = new Date(n.pubDate || Date.now());
        const time = d.toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"});
        const emoji = n.score <= -5 ? "🔴" : n.score <= -2 ? "🟠" : n.score >= 5 ? "🟢" : n.score >= 2 ? "🟡" : "⚪";
        return `<div class="news-item"><span>${emoji}</span><b>[${time}]</b> ${n.title}</div>`;
    }).join("");

    if (rollingScore <= -16) { set("extreme-red", "VXX LONG MAXI — CRASH INCOMING"); beep(250,4); }
    else if (rollingScore <= -9) { set("red", "VXX LONG — Risk-Off violent"); beep(300,2); }
    else if (rollingScore >= 16) { set("extreme-green", "SHORT VXX GROS — MELT-UP"); beep(900,4); }
    else if (rollingScore >= 9) set("green", "Risk-On — Short VIX ou calls SPY");
    else set("neutral", "CHOPPY — flat ou scalp");

    function set(cls, msg) {
        circle.className = `circle ${cls}`;
        sentimentText.textContent = msg;
        sentimentText.className = `sentiment-${cls.split("-")[0]}`;
    }
}

function beep(f=440, r=1) {
    try {
        const a = new (window.AudioContext || window.webkitAudioContext)();
        const o = a.createOscillator(); const g = a.createGain();
        o.connect(g); g.connect(a.destination);
        o.frequency.value = f; g.gain.value = 0.15;
        o.start(); o.stop(a.currentTime + 0.25);
        for(let i=0; i<r; i++) setTimeout(()=>navigator.vibrate?.([200,100,200]), i*400);
    } catch(e) {}
}

update();
setInterval(update, 26000);
