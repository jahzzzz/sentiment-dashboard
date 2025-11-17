// === DOM ===
const newsContainer = document.getElementById("news");
const circle = document.getElementById("sentiment-circle");
const sentimentText = document.getElementById("sentiment-text");

// === GESTION HISTORIQUE + RESET MINUIT ===
function loadStoredNews() {
    const raw = localStorage.getItem("sentimentNews");
    return raw ? JSON.parse(raw) : [];
}

function saveStoredNews(arr) {
    localStorage.setItem("sentimentNews", JSON.stringify(arr));
}

function dailyResetCheck() {
    const last = localStorage.getItem("lastResetDate");
    const today = new Date().toLocaleDateString("fr-FR");

    if (last !== today) {
        localStorage.setItem("sentimentNews", JSON.stringify([]));
        localStorage.setItem("lastResetDate", today);
        console.log("🕛 Reset automatique (nouveau jour)");
    }
}

dailyResetCheck();

// === Format heure (heure FR locale à partir du timestamp) ===
function formatTimeFromTs(ts) {
    if (!ts) return "--:--";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

// === SOURCES RSS (on garde un set raisonnable) ===
const sources = [
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://www.reuters.com/pf/resources/rss/markets.xml",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://www.fxstreet.com/rss/news",
    "https://www.investing.com/rss/news_25.rss",
    "https://www.investing.com/rss/news_285.rss",
    "https://news.google.com/rss/search?q=stock+market&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=nasdaq&hl=en-US&gl=US&ceid=US:en"
];

// === Mots-clés ===
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

// === Filtre marché strict ===
const marketFilter =
/stock|market|dow|nasdaq|s&p|spx|sp500|fed|rate|inflation|yield|treasury|vix|volatility|earnings|cpi|ppi|fomc|powell|bond|10-?year/i;

// === RSS → JSON via API rss2json (CORS OK) ===
async function fetchRSS(url) {
    const apiUrl = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(url);

    try {
        const res = await fetch(apiUrl, { cache: "no-store" });
        if (!res.ok) {
            console.warn("❌ RSS fail:", url, res.status);
            return [];
        }
        const data = await res.json();
        if (!data.items || !Array.isArray(data.items)) return [];
        return data.items;
    } catch (e) {
        console.warn("❌ RSS exception:", url, e);
        return [];
    }
}

// === FETCH NEWS ===
let rollingScore = 0;

async function fetchNews() {
    let newEntries = [];
    let rawScore = 0;

    for (const url of sources) {
        const items = await fetchRSS(url);
        if (!items.length) continue;

        for (const item of items) {
            const title = item.title || "";
            const desc  = item.description || "";
            const full  = (title + " " + desc).toLowerCase();

            if (!marketFilter.test(full)) continue;

            let score = 0;
            for (const [weight, patterns] of Object.entries(keywords)) {
                for (const p of patterns) {
                    if (p.test(full)) score += parseInt(weight);
                }
            }

            if (/breaking|urgent|flash/i.test(title)) {
                score += score < 0 ? -3 : 2;
            }

            rawScore += score;

            const pubTs = item.pubDate ? Date.parse(item.pubDate) : Date.now();

            newEntries.push({
                title,
                score,
                timestamp: isNaN(pubTs) ? Date.now() : pubTs
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

    // Tri par heure (récent → ancien)
    stored.sort((a, b) => b.timestamp - a.timestamp);

    // On garde jusqu'à 150 news dans l'affichage
    const html = stored.slice(0, 150).map(n => {
        const timeStr = formatTimeFromTs(n.timestamp);

        const colorEmoji =
            n.score <= -3 ? "🔴" :
            n.score <= -1 ? "🟠" :
            n.score >= 3  ? "🟢" :
            n.score >= 1  ? "🟡" :
                            "⚪";

        return `
            <div class="news-item">
                <span>${colorEmoji}</span>
                <b>[${timeStr}]</b> ${n.title}
            </div>
        `;
    }).join("");

    newsContainer.innerHTML = html;

    // Sentiment global (VXX playbook)
    if (score <= -12) setSentiment("extreme-red", "VXX LONG AGRESSIF — SIZE GROS");
    else if (score <= -6) setSentiment("red", "VXX LONG — Risk-Off clair");
    else if (score >= 12) setSentiment("extreme-green", "SHORT VXX AGRESSIF — Melt-up");
    else if (score >= 6) setSentiment("green", "SHORT VXX ou flat — Risk-On");
    else setSentiment("neutral", "CHOPPY — Attendre ou scalp micro");
}

function setSentiment(color, message) {
    circle.className = `circle ${color}`;
    sentimentText.textContent = message;
    sentimentText.className = `sentiment-${color.split("-")[0]}`;
}

// === Lancement ===
fetchNews();
setInterval(fetchNews, 60000); // 60s pour éviter de spam l'API
