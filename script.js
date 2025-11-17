// === DOM ===
const newsContainer = document.getElementById("news");
const circle = document.getElementById("sentiment-circle");
const sentimentText = document.getElementById("sentiment-text");

// === SOURCES 2025 (les seuls qui comptent vraiment pour le VIX intraday) ===
const sources = [
    "https://feeds.feedburner.com/zerohedge",                           // Incontournable
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",           // US Markets
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",                    // WSJ (or pur)
    "https://www.reuters.com/pf/resources/rss/markets.xml",             // Reuters Markets (souvent le 1er à sortir les flashs)
    "https://seekingalpha.com/api/v3/news/rss?limit=30",                // Très rapide sur earnings
    "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNR4n1CU9MVWlnU0FtcGhHZ0pMVW1"
    // Google News Finance (filtre "markets" uniquement) → c’est une mine d’or cachée
];

// === MOTS-CLÉS ULTRA PRÉCIS + REGEX pour éviter les faux positifs ===
const keywords = {
    "-6": [/vix.?spike/i, /contagion/i, /circuit.?breaker/i, /margin.?call/i],
    "-5": [/crash/i, /plunge/i, /meltdown/i, /liquidation.?cascade/i, /systemic/i],
    "-4": [/hard.?landing/i, /default/i, /credit.?event/i, /bank.?run/i],
    "-3": [/war/i, /missile/i, /strike/i, /attack.?on/i, /nuclear/i, /government.?shutdown/i, /hawkish.?surprise/i],
    "-2": [/hot.?cpi/i, /hot.?ppi/i, /rate.?hike/i, /hawkish.?powell/i, /china.?taiwan/i, /middle.?east.?escalat/i],
    "-1": [/volatility/i, /uncertainty/i, /risk-?off/i, /safe.?haven/i],

    "+1": [/beat/i, /strong/i, /resilient/i, /soft.?landing/i, /cooling.?inflation/i],
    "+2": [/risk-?on/i, /vix.?crush/i, /rally/i, /bullish.?momentum/i, /fed.?pivot/i],
    "+3": [/dovish.?surprise/i, /rate.?cut.?50/i, /qe/i, /stimulus/i],
    "+5": [/melt-?up/i, /euphoria/i, /fomo/i, /vix.?termination/i]
};

// Filtre marché (encore plus strict)
const marketFilter = /stock|market|dow|nasdaq|s&p|spx|fed|rate|inflation|yield|treasury|vix|volatility|earnings|cpi|ppi|fomc|powell|bond|10-?year/i;

// Variables globals
let rollingScore = 0;
let lastUpdate = 0;

async function fetchNews() {
    const start = performance.now();
    let allNews = [];
    let rawScore = 0;
    let count = 0;

    for (const url of sources) {
        try {
            const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const res = await fetch(proxy, { cache: "no-store" });
            const data = await res.json();
            const parser = new DOMParser();
            const xml = parser.parseFromString(data.contents, "text/xml");
            const items = xml.querySelectorAll("item");

            for (const item of items) {
                if (count >= 60) break;

                const title = (item.querySelector("title")?.textContent || "").trim();
                const desc = (item.querySelector("description")?.textContent || "").trim();
                const full = (title + " " + desc).toLowerCase();

                // Filtre marché obligatoire
                if (!marketFilter.test(full)) continue;

                let score = 0;

                // Regex + mots classiques
                for (const [weight, patterns] of Object.entries(keywords)) {
                    for (const pattern of patterns) {
                        if (typeof pattern === "string" ? full.includes(pattern.toLowerCase()) : pattern.test(full)) {
                            score += parseInt(weight);
                        }
                    }
                }

                // GROS BOOST si "BREAKING" + mot négatif
                if ((title + desc).match(/breaking|urgent|live|flash/i)) {
                    score += score < 0 ? -4 : score > 0 ? 2 : -2;
                }

                // Pénalité si trop vieux (certains flux gardent des vieux titres)
                const pubDate = item.querySelector("pubDate")?.textContent || "";
                const ageMinutes = pubDate ? (Date.now() - new Date(pubDate)) / 60000 : 0;
                if (ageMinutes > 180) continue; // on vire tout ce qui a plus de 3h

                if (score !== 0) {
                    allNews.push({ title, score, rawTitle: title });
                    rawScore += score;
                    count++;
                }
            }
        } catch (e) {
            // silent fail
        }
    }

    // EMA ultra réactive mais stable (alpha = 0.4 sur 30s refresh)
    rollingScore = rollingScore === 0 ? rawScore : rollingScore * 0.6 + rawScore * 0.4;

    updateUI(allNews, rollingScore, count);
    lastUpdate = Date.now();
    console.log(`Update en ${(performance.now() - start).toFixed(0)}ms | ${count} articles | Score: ${rollingScore.toFixed(1)}`);
}

function updateUI(news, score) {
    news.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    
    newsContainer.innerHTML = news.slice(0, 25).map(n => `
        <div class="news-item">
            <span style="color:${n.score <= -3 ? '#ff0000' : n.score <= -1 ? '#ff6b6b' : n.score >= 3 ? '#00ff00' : n.score >= 1 ? '#71ff9e' : '#aaaaaa'}">
                ${n.score <= -3 ? '🔴' : n.score <= -1 ? '🟠' : n.score >= 3 ? '🟢' : n.score >= 1 ? '🟡' : '⚪'}
            </span>
            ${n.rawTitle}
        </div>
    `).join("");

    // Seuils que j’utilise vraiment en trading live
    if (score <= -12)       { setSentiment("extreme-red",   "VXX LONG AGRESSIF — SIZE GROS"); }
    else if (score <= -6)   { setSentiment("red",           "VXX LONG — Risk-Off clair"); }
    else if (score >= 12)   { setSentiment("extreme-green", "SHORT VXX AGRESSIF — Melt-up"); }
    else if (score >= 6)    { setSentiment("green",         "SHORT VXX ou flat — Risk-On"); }
    else                    { setSentiment("neutral",      "CHOPPY — Attendre ou scalp micro"); }
}

function setSentiment(color, message) {
    circle.className = `circle ${color}`;
    sentimentText.textContent = message;
    sentimentText.className = `sentiment-${color.split("-")[0]}`;
}

// Lancement + refresh 25s (sweet spot perf/stabilité)
fetchNews();
setInterval(fetchNews, 25000);
