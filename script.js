// === DOM ===
const newsContainer = document.getElementById("news");
const circle = document.getElementById("sentiment-circle");
const sentimentText = document.getElementById("sentiment-text");

// === STORAGE KEYS (version 2 pour éviter les vieilles données) ===
const STORAGE_KEY = "sentimentNews_v2";
const RESET_KEY = "lastResetDate_v2";

// === GESTION HISTORIQUE + RESET MINUIT ===
function loadStoredNews() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveStoredNews(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function dailyResetCheck() {
    const last = localStorage.getItem(RESET_KEY);
    const today = new Date().toLocaleDateString("fr-FR");

    if (last !== today) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        localStorage.setItem(RESET_KEY, today);
        console.log("🕛 Reset automatique (nouveau jour)");
    }
}

dailyResetCheck();

// === SOURCES RSS ===
const primarySources = [
    "https://feeds.feedburner.com/zerohedge",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://www.reuters.com/pf/resources/rss/markets.xml",
    "https://seekingalpha.com/api/v3/news/rss?limit=30",
    "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNR4n1CU9MVWlnU0FtcGhHZ0pMVW1"
];

const secondarySources = [
    "https://www.investing.com/rss/news_25.rss",
    "https://www.investing.com/rss/news_285.rss",
    "https://www.fxstreet.com/rss/news",
    "https://www.kitco.com/rss/economic_calendar.rss",
    "https://www.kitco.com/rss/news.rss"
];

const backupSources = [
    "https://news.google.com/rss/search?q=nasdaq&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=stock+market&hl=en-US&gl=US&ceid=US:en"
];

// === MOTS-CLÉS ===
const keywords = {
    "-6": [/vix.?spike/i, /contagion/i, /circuit.?breaker/i, /margin.?call/i],
    "-5": [/crash/i, /plunge/i, /meltdown/i, /liquidation.?cascade/i, /systemic/i],
    "-4": [/hard.?landing/i, /default/i, /credit.?event/i, /bank.?run/i],
    "-3": [/war/i, /missile/i, /strike/i, /attack.?on/i, /nuclear/i, /government.?shutdown/i, /hawkish.?surprise/i],
    "-2": [/hot.?cpi/i, /hot.?ppi/i, /rate.?hike/i, /hawkish.?powell/i],
    "-1": [/volatility/i, /uncertainty/i, /risk-?off/i, /safe.?haven/i],

    "+1": [/beat/i, /strong/i, /resilient/i, /soft.?landing/i, /cooling.?inflation/i],
    "+2": [/risk-?on/i, /vix.?crush/i, /rally/i, /bullish.?momentum/i, /fed.?pivot/i],
    "+3": [/dovish.?surprise/i, /rate.?cut.?50/i, /qe/i, /stimulus/i],
    "+5": [/melt-?up/i, /euphoria/i, /fomo/i, /vix.?termination/i]
};

// === Filtre marche global ===
const marketFilter = /stock|market|dow|nasdaq|s&p|spx|fed|rate|inflation|yield|treasury|vix|volatility|earnings|cpi|ppi|fomc|powell|bond|10-?year/i;

// === UTIL: fetch RSS via rss2json (CORS OK) ===
async function fetchRss(url) {
    const apiUrl = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(url);
    try {
        const res = await fetch(apiUrl, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        return data.items || [];
    } catch (e) {
        console.warn("RSS fail:", url, e.message);
        return [];
    }
}

// === FETCH NEWS ===
let rollingScore = 0;
const MAX_ITEMS = 60;

async function fetchNews() {
    const allSources = [...primarySources, ...secondarySources, ...backupSources];
    let newEntries = [];
    let rawScore = 0;

    for (const url of allSources) {
        if (newEntries.length >= MAX_ITEMS) break;

        const items = await fetchRss(url);
        for (const item of items) {
            if (newEntries.length >= MAX_ITEMS) break;

            const title = item.title || "";
            const desc = (item.description || "").replace(/<[^>]+>/g, " ");
            const full = (title + " " + desc).toLowerCase();

            if (!marketFilter.test(full)) continue;

            let score = 0;
            for (const [weight, patterns] of Object.entries(keywords)) {
                for (const p of patterns) {
                    if (p.test(full)) score += parseInt(weight, 10);
                }
            }

            if (/breaking|urgent|flash/i.test(title)) {
                score += score < 0 ? -3 : 2;
            }

            const pubDate = item.pubDate || item.pubdate || "";
            const ts = pubDate ? Date.parse(pubDate) || Date.now() : Date.now();

            rawScore += score;

            newEntries.push({
                title,
                score,
                pubDate,
                timestamp: ts
            });
        }
    }

    rollingScore = rollingScore === 0
        ? rawScore
        : rollingScore * 0.6 + rawScore * 0.4;

    updateUI(newEntries, rollingScore);
}

// === UI ===
function updateUI(fetchedNews, score) {
    let stored = loadStoredNews();

    // Ajout sans doublons (par titre)
    for (const n of fetchedNews) {
        if (!stored.find(s => s.title === n.title)) {
            stored.push(n);
        }
    }

    saveStoredNews(stored);

    // Tri du plus récent au plus ancien
    stored.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const list = stored.slice(0, 40);

    const html = list.map(n => {
        const d = n.pubDate ? new Date(n.pubDate) : new Date(n.timestamp || Date.now());
        const timeStr = isNaN(d.getTime())
            ? "??:??:??"
            : d.toLocaleTimeString("fr-FR", { hour12: false });

        const colorEmoji =
            n.score <= -3 ? "🔴" :
            n.score <= -1 ? "🟠" :
            n.score >= 3  ? "🟢" :
            n.score >= 1  ? "🟡" : "⚪";

        return `
            <div class="news-item">
                <span>${colorEmoji}</span>
                <b>[${timeStr}]</b> ${n.title}
            </div>
        `;
    }).join("");

    newsContainer.innerHTML = html;

    // Sentiment global
    if (score <= -12) setSentiment("extreme-red", "VXX LONG AGRESSIF — SIZE GROS");
    else if (score <= -6) setSentiment("red", "VXX LONG — RISK-OFF CLAIR");
    else if (score >= 12) setSentiment("extreme-green", "SHORT VXX AGRESSIF — MELT-UP");
    else if (score >= 6) setSentiment("green", "SHORT VXX OU FLAT — RISK-ON");
    else setSentiment("neutral", "CHOPPY — Attendre ou scalp micro");
}

function setSentiment(color, message) {
    circle.className = `circle ${color}`;
    sentimentText.textContent = message;
    sentimentText.className = `sentiment-${color.split("-")[0]}`;
}

// === Lancement ===
fetchNews();
setInterval(fetchNews, 25000);
