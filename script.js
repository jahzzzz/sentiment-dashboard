// script.js – v7 US-ONLY CLEAN – 17 nov 2025 (la version qui ne bouge plus jamais pour des ânes)
const newsContainer = document.getElementById("news");
const circle = document.getElementById("sentiment-circle");
const sentimentText = document.getElementById("sentiment-text");

const STORAGE_KEY = "sentiment_clean_v7";
if (localStorage.getItem("day") !== new Date().toLocaleDateString("fr-FR")) {
    localStorage.clear(); // reset total chaque jour
    localStorage.setItem("day", new Date().toLocaleDateString("fr-FR"));
}

let rollingScore = 0;

// Sources ultra-clean (seulement les 4 qui comptent vraiment)
const sources = [
    "https://feeds.feedburner.com/zerohedge",                    // le plus rapide sur les vrais moves
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",     // CNBC US markets
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",             // WSJ/Dow Jones
    "https://seekingalpha.com/api/v3/news/rss?limit=30"          // Seeking Alpha (filtré après)
];

// Mots-clés 2025 – ultra-restrictifs, que du lourd
const keywords = {
    "-12": [/vix.{0,20}(spike|surge|explode|40|50)/i, /circuit.?breaker/i, /trading.?halt/i],
    "-10": [/crash|plunge|meltdown|liquidation|forced.?selling/i],
    "-8":  [/recession.?confirmed|hard.?landing|bank.?run|default/i],
    "-6":  [/hawkish.?surprise|hike.?(75|100)|powell.?hawk|war|missile|nuke/i],
    "-4":  [/hot.?cpi|sticky.?inflation|rate.?hike|risk.?off/i],
    "+10": [/emergency.?cut|cut.?(75|100)|qe/i],
    "+8":  [/melt.?up|euphoria|fomo|parabolic|squeeze/i],
    "+6":  [/dovish.?surprise|fed.?pivot|stimulus|rate.?cut/i],
    "+4":  [/soft.?landing|cool.?cpi|risk.?on|vix.?crush/i]
};

// Filtre US-only + marché seulement
const strictFilter = /spx|s&p|nasdaq|dow|vix|fed|powell|fomc|cpi|ppi|nvidia|tesla|apple|msft|rate.?cut|hike|earnings|treasury|yield|dollar|dxy/i;

async function fetchRSS(url) {
    try {
        const r = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent(url));
        const d = await r.json();
        const xml = new DOMParser().parseFromString(d.contents, "text/xml");
        return Array.from(xml.querySelectorAll("item")).map(item => ({
            title: (item.querySelector("title")?.textContent || "").trim(),
            desc:  (item.querySelector("description")?.textContent || "").replace(/<[^>]+>/g," ").trim(),
            date:  item.querySelector("pubDate")?.textContent || new Date().toISOString()
        }));
    } catch { return []; }
}

async function run() {
    let raw = 0, validItems = [];

    for (const url of sources) {
        const items = await fetchRSS(url);
        for (const i of items) {
            const text = (i.title + " " + i.desc).toLowerCase();
            if (!strictFilter.test(text)) continue; // vire tout ce qui n'est pas US marché

            let score = 0;
            for (const [w, regs] of Object.entries(keywords)) {
                for (const r of regs) if (r.test(text)) score += parseInt(w);
            }
            if (/breaking|urgent|flash|live/i.test(i.title)) score += score < 0 ? -6 : +6;

            const ageMin = (Date.now() - new Date(i.date)) / 60000;
            const decay = ageMin < 30 ? 1 : ageMin < 120 ? 0.6 : 0.2;
            const finalScore = score * decay;
            if (Math.abs(finalScore) >= 3) { // on ignore tout ce qui fait moins de ±3
                raw += finalScore;
                validItems.push({title: i.title, score: finalScore, date: i.date});
            }
        }
    }

    // Lissage très doux + zéro boost débile
    rollingScore = rollingScore === 0 ? raw : rollingScore * 0.85 + raw * 0.15;

    // Stockage & affichage (max 25 news propres)
    let stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    validItems.forEach(n => { if (!stored.some(s=>s.title===n.title)) stored.push(n); });
    stored.sort((a,b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.slice(0,200)));

    newsContainer.innerHTML = stored.slice(0,25).map(n => {
        const t = new Date(n.date).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
        const e = n.score <= -8 ? "🔴" : n.score <= -4 ? "🟠" : n.score >= 8 ? "🟢" : n.score >= 4 ? "🟡" : "⚪";
        return `<div class="news-item"><span>${e}</span><b>[${t}]</b> ${n.title}</div>`;
    }).join("") || "<div style='text-align:center;color:#666'>Aucune news majeure (marché calme)</div>";

    // Seuils ultra-stables
    if (rollingScore <= -10) set("extreme-red", "VXX LONG GROS — CRASH MODE");
    else if (rollingScore <= -6) set("red", "VXX LONG — Risk-Off");
    else if (rollingScore >= 10) set("extreme-green", "SHORT VXX GROS — MELT-UP");
    else if (rollingScore >= 6) set("green", "Risk-On — Short VIX");
    else set("neutral", "CHOPPY / CALME — attendre vrai signal");

    function set(c,m) {
        circle.className = `circle ${c}`;
        sentimentText.textContent = m;
    }
}

run();
setInterval(run, 45000); // toutes les 45s → plus de flip-flop débile
