// script.js – v15 NASDAQ HIGH-IMPACT SCALPING – Anti-CORS + Fallback (17 nov 2025)
const newsContainer = document.getElementById("news");
const circle = document.getElementById("sentiment-circle");
const sentimentText = document.getElementById("sentiment-text");
const STORAGE_KEY = "nasdaq_impact_v15";
const DAY_KEY = "lastDay_v15";

// Reset minuit auto
const today = new Date().toLocaleDateString("fr-FR");
if (localStorage.getItem(DAY_KEY) !== today) {
    localStorage.setItem(STORAGE_KEY, "[]");
    localStorage.setItem(DAY_KEY, today);
    console.log("🕛 Reset minuit – Nouvelle journée");
}
let rollingScore = 0;
let lastCheck = -1;

// Sources élargies, stables
const sources = [
    "https://www.investing.com/rss/news_25.rss",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=ndx&region=US&lang=en-US",
    "https://feeds.bloomberg.com/markets/news.rss"  // + Bloomberg, stable
];

// Keywords / Filtre inchangés
const keywords = {
    "-10": [/nasdaq.?crash|tech.?plunge|circuit.?breaker/i],
    "-8": [/nasdaq.?recession|earnings.?miss.?nvidia|ai.?bubble.?burst/i],
    "-6": [/nasdaq.?selloff|vix.?spike.?tech|hawkish/i],
    "-4": [/nasdaq.?correction|risk.?off.?tech|uncertainty.?nasdaq/i],
    "+10": [/nasdaq.?melt.?up|ai.?boom|rate.?cut.?tech/i],
    "+8": [/nvidia.?beat|fed.?pivot.?tech|stimulus.?ai/i],
    "+6": [/nasdaq.?rebound|earnings.?beat.?tech|soft.?landing.?tech/i],
    "+4": [/nasdaq.?rally|risk.?on.?tech|vix.?crush/i]
};
const impactFilter = /nasdaq|ndx|tech|ai|nvidia|earnings.?tech|breaking.?nasdaq/i;

async function fetchRSS(url) {
    const proxy = 'https://cors-anywhere.herokuapp.com/';  // Nouveau proxy anti-CORS
    try {
        const r = await fetch(proxy + url);
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        const d = await r.text();  // Direct text pour XML fragile
        const xml = new DOMParser().parseFromString(d, "text/xml");
        const parserError = xml.querySelector("parsererror");
        if (parserError) throw new Error("XML parse error: " + parserError.textContent);
        return Array.from(xml.querySelectorAll("item")).map(item => {
            let title = (item.querySelector("title")?.textContent || "").trim();
            let desc = (item.querySelector("description")?.textContent || "").replace(/<[^>]+>/g, " ").trim();
            let dateStr = item.querySelector("pubDate")?.textContent || new Date().toISOString();
            let date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                dateStr = dateStr.replace(/([+-]\d{4})$/, ' UTC$1');
                date = new Date(dateStr);
            }
            return { title, desc, date: date.toISOString() };
        }).filter(i => {
            const text = (i.title + i.desc).toLowerCase();
            return impactFilter.test(text) && !isNaN(new Date(i.date).getTime());
        });
    } catch (e) {
        console.error(`RSS fail ${url}:`, e.message);
        return [];
    }
}

async function run() {
    const now = new Date();
    const currentMin = now.getMinutes();
    const currentBlock = Math.floor(currentMin / 2) * 2 + now.getHours() * 60;
    if (currentBlock === lastCheck) return;
    lastCheck = currentBlock;
    console.log(`🕐 Scalp check à ${now.toLocaleTimeString("fr-FR")} – Block ${currentBlock}`);

    let raw = 0, highImpactItems = [], totalFetched = 0;
    for (const url of sources) {
        const items = await fetchRSS(url);
        totalFetched += items.length;
        console.log(`${url}: ${items.length} items filtrés`);
        for (const i of items.slice(0, 10)) {
            const text = (i.title + " " + i.desc).toLowerCase();
            let score = 0;
            for (const [w, regs] of Object.entries(keywords)) {
                for (const r of regs) if (r.test(text)) score += parseInt(w);
            }
            if (Math.abs(score) < 3) continue;
            if (/breaking|high.?impact|urgent|nasdaq/i.test(text)) score *= 1.5;
            const ageMin = (now - new Date(i.date)) / 60000;
            if (ageMin > 1440) continue;
            const decay = ageMin < 60 ? 1 : 0.7;
            raw += score * decay;
            highImpactItems.push({title: i.title, score: score * decay, date: i.date});
        }
    }

    // Fallback si <2 items : Log alerte (tu peux ajouter un fetch manuel ici)
    if (totalFetched < 2) {
        console.warn("⚠️ Fallback needed: Low fetch, check proxy/CORS extension");
        // Option : Ajoute un fetch vers une API gratuite comme NewsAPI (clé requise)
    }

    rollingScore = rollingScore === 0 ? raw : rollingScore * 0.7 + raw * 0.3;

    // Stockage / UI inchangés (comme v14)
    let stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    highImpactItems.forEach(n => {
        if (!stored.some(s => s.title === n.title && (now - new Date(s.date)) < 86400000)) {
            stored.push(n);
        }
    });
    stored = stored.filter(s => (now - new Date(s.date)) < 86400000);
    stored.sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.slice(0, 50)));

    newsContainer.innerHTML = stored.slice(0, 10).map(n => {
        const t = new Date(n.date).toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"});
        const e = n.score <= -6 ? "🔴" : n.score <= -3 ? "🟠" : n.score >= 6 ? "🟢" : n.score >= 3 ? "🟡" : "⚪";
        return `<div class="news-item"><span>${e}</span><b>[${t}]</b> ${n.title}</div>`;
    }).join("") || "<div style='text-align:center;color:#aaa'>Pas de news high-impact Nasdaq (≥3 étoiles) – Vérifie CORS</div>";

    const todayCount = stored.length;
    console.log(`Items today: ${todayCount} | Rolling: ${Math.round(rollingScore)} | Total fetched: ${totalFetched}`);
    if (todayCount < 2) {
        set("neutral", `NEUTRE – Seulement ${todayCount} news ≥3 étoiles (fetch low: ${totalFetched}), active CORS proxy`);
    } else if (rollingScore >= 6) {
        set("green", "VERT – Haussier net (≥2 news high-impact, scalp long NDX)");
    } else if (rollingScore <= -6) {
        set("red", "ROUGE – Baissier net (≥2 news high-impact, scalp short ou out)");
    } else {
        set("neutral", `NEUTRE – ≥2 news mais équilibré (${Math.round(rollingScore)})`);
    }

    function set(c, m) {
        circle.className = `circle ${c}`;
        sentimentText.textContent = m;
    }
}

run();
setInterval(run, 120000);  // 2 min
