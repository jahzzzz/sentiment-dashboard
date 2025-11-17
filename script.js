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
        // Reset complet
        localStorage.setItem("sentimentNews", JSON.stringify([]));
        localStorage.setItem("lastResetDate", today);
        console.log("🕛 Reset automatique (nouveau jour)");
    }
}

dailyResetCheck();


// === SOURCES ===
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


// === Filtre strict ===
const marketFilter = /stock|market|dow|nasdaq|s&p|spx|fed|rate|inflation|yield|treasury|vix|volatility|earnings|cpi|ppi|fomc|powell|bond|10-?year/i;


// === Traduction auto (API Libre Français) ===
// GRATUIT + illimité via MyMemory
async function translateToFrench(text) {
    try {
        const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=en|fr";
        const r = await fetch(url);
        const j = await r.json();
        return j.responseData.translatedText || text;
    } catch {
        return text;
    }
}


// === PROXY ===
async function fetchWithProxy(url) {
    const proxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        `https://cors.isomorphic-git.org/${url}`
    ];

    for (let proxy of proxies) {
        try {
            const res = await fetch(proxy, { cache: "no-store" });
            if (!res.ok) continue;

            const data = await res.json();
            if (data.contents) return data.contents;

        } catch {}
    }
    return null;
}


// === FETCH NEWS ===
let rollingScore = 0;

async function fetchNews() {
    const allSources = [...primarySources, ...secondarySources, ...backupSources];

    let newEntries = [];
    let rawScore = 0;

    for (const url of allSources) {
        const xmlText = await fetchWithProxy(url);
        if (!xmlText) continue;

        const xml = new DOMParser().parseFromString(xmlText, "text/xml");
        const items = xml.querySelectorAll("item");

        for (const item of items) {
            const title = item.querySelector("title")?.textContent || "";
            const desc = item.querySelector("description")?.textContent || "";
            const pub = item.querySelector("pubDate")?.textContent || "";
            const full = (title + " " + desc).toLowerCase();

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

            newEntries.push({
                title,
                score,
                pubDate: pub,
                timestamp: Date.now()
            });
        }
    }

    rollingScore = rollingScore === 0
        ? rawScore
        : rollingScore * 0.6 + rawScore * 0.4;

    updateUI(newEntries, rollingScore);
}


// === UI ===
async function updateUI(fetchedNews, score) {
    let stored = loadStoredNews();

    // Ajout sans doublons
    for (const n of fetchedNews) {
        if (!stored.find(s => s.title === n.title)) stored.push(n);
    }

    saveStoredNews(stored);

    // Tri par heure (récent → ancien)
    stored.sort((a, b) => b.timestamp - a.timestamp);

    // Génération HTML avec traduction + heure
    const html = await Promise.all(
        stored.slice(0, 40).map(async n => {
            const translated = await translateToFrench(n.title);
            const time = n.pubDate ? new Date(n.pubDate).toLocaleTimeString("fr-FR") : "⏱️ ?";

            const color =
                n.score <= -3 ? "🔴" :
                n.score <= -1 ? "🟠" :
                n.score >= 3 ? "🟢" :
                n.score >= 1 ? "🟡" : "⚪";

            return `
                <div class="news-item">
                    <span>${color}</span>
                    <b>[${time}]</b> ${n.title}
                    <div class="translation">🇫🇷 ${translated}</div>
                </div>
            `;
        })
    );

    newsContainer.innerHTML = html.join("");

    // Sentiment
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
setInterval(fetchNews, 25000);
