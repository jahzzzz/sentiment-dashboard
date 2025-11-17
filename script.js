// script.js – Version finale 17 nov 2025 – 100% anti-422, ultra-stable
const newsContainer = document.getElementById("news");
const circle = document.getElementById("sentiment-circle");
const sentimentText = document.getElementById("sentiment-text");

const STORAGE_KEY = "sentiment_v2025_final";
if (localStorage.getItem("day") !== new Date().toLocaleDateString("fr-FR")) {
    localStorage.setItem(STORAGE_KEY, "[]");
    localStorage.setItem("day", new Date().toLocaleDateString("fr-FR"));
}

let rollingScore = 0;

// Mots-clés ultra-calibrés 2025
const keywords = {
    "-12": [/vix.?spike.{0,15}(3|4|5|6)\d/i, /circuit.?breaker/i, /trading.?halted/i],
    "-10": [/crash|plunge|meltdown|capitulation|forced.?liquidation/i],
    "-8":  [/bank.?run|default|systemic|contagion/i],
    "-6":  [/hard.?landing|recession.?confirmed|shutdown/i],
    "-5":  [/war|missile|nuke|escalation|hawkish.?surprise|hike.?75|hike.?100/i],
    "+10": [/emergency.?cut|rate.?cut.?(75|100)/i],
    "+8":  [/qe.?restart|stimulus.?package/i],
    "+7":  [/melt.?up|euphoria|fomo|parabolic/i],
    "+4":  [/dovish.?surprise|fed.?pivot|rate.?cut.?50/i],
    "-3":  [/hot.?cpi|sticky.?inflation|powell.?hawk/i],
    "+3":  [/cool.?cpi|disinflation|soft.?landing/i],
    "-2":  [/risk.?off|safe.?haven/i],
    "+2":  [/risk.?on|vix.?crush|rally/i]
};

const marketFilter = /stock|dow|nasdaq|s&p|spx|fed|rate|cpi|ppi|powell|vix|volatility|yield|treasury|fomc|earnings/i;

const sources = [
    "https://feeds.feedburner.com/zerohedge",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://seekingalpha.com/api/v3/news/rss?limit=50",
    "https://news.google.com/rss/search?q=when:1h+(vix+OR+spx+OR+fed+OR+powell)&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNR4n1CU9MVWlnU0FtcGhHZ0pMVW1"
];

// Proxy qui marche à 100% en 2025 (allorigins + fallback)
async function fetchRSS(url) {
    const proxies = [
        "https://api.allorigins.win/get?url=",
        "https://corsproxy.io/?",
        "https://cors-anywhere.herokuapp.com/"
    ];

    for (const proxy of proxies) {
        try {
            const r = await fetch(proxy + encodeURIComponent(url), { cache: "no-store" });
            if (!r.ok) continue;
            const data = await r.json();

            let content = data.contents || data;
            if (!content) continue;

            const parser = new DOMParser();
            const xml = parser.parseFromString(content, "text/xml");
            const items = xml.querySelectorAll("item");
            const result = [];

            items.forEach(item => {
                result.push({
                    title: (item.querySelector("title")?.textContent || "").trim(),
                    description: (item.querySelector("description")?.textContent || "").trim(),
                    pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString()
                });
            });
            return result;
        } catch (e) {
            continue;
        }
    }
    return [];
}

async function run() {
    let raw = 0, items = [];

    for (const url of sources) {
        const feed = await fetchRSS(url);
        for (const i of feed) {
            const title = i.title;
            const desc = i.description.replace(/<[^>]+>/g, " ");
            const full = (title + " " + desc).toLowerCase();
            if (!marketFilter.test(full)) continue;

            let score = 0;
            for (const [w, regs] of Object.entries(keywords)) {
                for (const r of regs) if (r.test(full)) score += parseInt(w);
            }
            if (/breaking|urgent|flash|live/i.test(title)) score += score < 0 ? -5 : +5;

            const ageMin = (Date.now() - new Date(i.pubDate).getTime()) / 60000;
            const decay = ageMin < 20 ? 1 : ageMin < 60 ? 0.7 : ageMin < 180 ? 0.3 : 0.1;
            raw += score * decay;

            items.push({title, score: score*decay, pubDate: i.pubDate});
        }
    }

    // Lissage réactif + boost pré-open US
    const hour = new Date().getHours();
    const boost = (hour >= 13 && hour < 17) ? 1.5 : 1.0;
    rollingScore = rollingScore === 0 ? raw : rollingScore * 0.65 + raw * 0.35;
    rollingScore *= boost;

    // Stockage + affichage
    let stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    for (const n of items) {
        if (!stored.some(s => s.title === n.title)) stored.push(n);
    }
    stored.sort((a,b) => new Date(b.pubDate) - new Date(a.pubDate));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.slice(0,300)));

    newsContainer.innerHTML = stored.slice(0,40).map(n => {
        const d = new Date(n.pubDate);
        const t = d.toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"});
        const e = n.score <= -6 ? "🔴" : n.score <= -3 ? "🟠" : n.score >= 6 ? "🟢" : n.score >= 3 ? "🟡" : "⚪";
        return `<div class="news-item"><span>${e}</span><b>[${t}]</b> ${n.title}</div>`;
    }).join("");

    // Seuils réactifs 2025
    if (rollingScore <= -14) { set("extreme-red", "VXX LONG MAXI — CRASH"); beep(200,6); }
    else if (rollingScore <= -8)  { set("red", "VXX LONG — Risk-Off fort"); beep(300,3); }
    else if (rollingScore >= 14)  { set("extreme-green", "SHORT VXX MAX — MELT-UP"); beep(900,6); }
    else if (rollingScore >= 8)   { set("green", "Risk-On fort — Short VIX"); }
    else if (rollingScore >= 3)   { set("green", "Risk-On léger"); }
    else if (rollingScore <= -3)  { set("red", "Risk-Off léger"); }
    else set("neutral", "CHOPPY — attendre");

    function set(c,m) {
        circle.className = `circle ${c}`;
        sentimentText.textContent = m;
        sentimentText.className = `sentiment-${c.split("-")[0]}`;
    }
}

function beep(f,r) {
    try {
        const a = new (window.AudioContext || window.webkitAudioContext)();
        const o = a.createOscillator(), g = a.createGain();
        o.connect(g); g.connect(a.destination);
        o.frequency.value = f; g.gain.value = 0.2;
        o.start(); o.stop(a.currentTime + 0.25);
        for(let i=0;i<r;i++) setTimeout(()=>navigator.vibrate?.([200,100,200]),i*400);
    } catch(e) {}
}

// GO
run();
setInterval(run, 24000);
