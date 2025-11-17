// === DOM ===
const newsContainer = document.getElementById("news");
const circle = document.getElementById("sentiment-circle");
const sentimentText = document.getElementById("sentiment-text");


// === SOURCES 2025 — optimisées VIX / NASDAQ ===
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
    "https://www.kitco.com/rss/news.rss",
    "https://www.theguardian.com/us/business/rss",
    "https://www.theguardian.com/business/economics/rss"
];

const backupSources = [
    "https://news.google.com/rss/search?q=nasdaq&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=stock+market&hl=en-US&gl=US&ceid=US:en"
];


// === MOTS-CLÉS ULTRA PRÉCIS ===
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


// === Filtre marché strict ===
const marketFilter = /stock|market|dow|nasdaq|s&p|spx|fed|rate|inflation|yield|treasury|vix|volatility|earnings|cpi|ppi|fomc|powell|bond|10-?year/i;


// === Variables ===
let rollingScore = 0;


// === PROXY ultra stable ===
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
            if (data.contents && data.contents.length > 50) return data.contents;

        } catch {}
    }
    return null;
}


// === FETCH NEWS PRO ===
async function fetchNews() {
    const t0 = performance.now();

    let allNews = [];
    let rawScore = 0;
    let count = 0;

    const allSources = [...primarySources, ...secondarySources, ...backupSources];

    for (const url of allSources) {
        if (count >= 60) break;

        const xmlText = await fetchWithProxy(url);
        if (!xmlText) continue;

        let xml;
        try {
            xml = new DOMParser().parseFromString(xmlText, "text/xml");
        } catch {
            continue;
        }

        const items = xml.querySelectorAll("item");
        if (!items.length) continue;

        for (const item of items) {
            if (count >= 60) break;

            const title = item.querySelector("title")?.textContent || "";
            const desc = item.querySelector("description")?.textContent || "";
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
            allNews.push({ title, score });
            count++;
        }
    }

    rollingScore = rollingScore === 0
        ? rawScore
        : rollingScore * 0.6 + rawScore * 0.4;

    updateUI(allNews, rollingScore);

    console.log(
        `Fetched: ${count} | Score: ${rollingScore.toFixed(1)} | ${(
            performance.now() - t0
        ).toFixed(0)}ms`
    );
}


// === UI ===
function updateUI(news, score) {
    news.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    newsContainer.innerHTML = news.slice(0, 25)
        .map(n => `
        <div class="news-item">
            <span style="color:${n.score <= -3 ? '#ff0000'
                : n.score <= -1 ? '#ff6b6b'
                : n.score >= 3 ? '#00ff00'
                : n.score >= 1 ? '#71ff9e'
                : '#aaaaaa'}">
                ${n.score <= -3 ? '🔴'
                : n.score <= -1 ? '🟠'
                : n.score >= 3 ? '🟢'
                : n.score >= 1 ? '🟡'
                : '⚪'}
            </span>
            ${n.title}
        </div>
    `).join("");

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
