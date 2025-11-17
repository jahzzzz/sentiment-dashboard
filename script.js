<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>VIX Sentiment GOD MODE</title>
<style>
  body{font-family:system-ui;background:#000;color:#0f0;margin:0;padding:10px}
  #news{max-height:85vh;overflow-y:auto;font-size:14px;line-height:1.5}
  .news-item{padding:4px 0;border-bottom:1px solid #030}
  .circle{width:160px;height:160px;border-radius:50%;margin:15px auto;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:999;transition:all .8s;box-shadow:0 0 40px}
  .extreme-red{background:#600;box-shadow:0 0 60px #f00;animation:pulse 1.5s infinite}
  .red{background:#900;}
  .neutral{background:#333;}
  .green{background:#060;}
  .extreme-green{background:#090;box-shadow:0 0 60px #0f0;animation:pulse 1.5s infinite}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
  #chart{height:80px;margin:10px 0;background:#111;border:1px solid #0f0}
</style>
</head><body>
<div style="text-align:center">
  <div id="sentiment-circle" class="circle neutral">CHOPPY</div>
  <div id="sentiment-text" style="font-size:26px;margin:10px">Attendre confirmation</div>
  <canvas id="chart" width="800" height="80"></canvas>
</div>
<div id="news"></div>

<script>
// === v4 - GOD MODE (17 nov 2025) ===
const STORAGE_KEY = "sentimentNews_v4";
const SCORE_HISTORY_KEY = "scoreHistory_v4";
const newsContainer = document.getElementById("news");
const circle = document.getElementById("sentiment-circle");
const sentimentText = document.getElementById("sentiment-text");
const chartCtx = document.getElementById("chart").getContext("2d");

let rollingScore = 0;
let scoreHistory = JSON.parse(localStorage.getItem(SCORE_HISTORY_KEY) || "[]");

// Reset quotidien + purge histoire >24h
const today = new Date().toLocaleDateString("fr-FR");
if (localStorage.getItem("lastReset_v4") !== today) {
    localStorage.setItem(STORAGE_KEY, "[]");
    localStorage.setItem("lastReset_v4", today);
    scoreHistory = [];
}
scoreHistory = scoreHistory.filter(h => Date.now() - h.t < 24*60*60*1000);

// === MOTS-CLÉS v4 (les plus tranchants du marché 2024-2025) ===
const keywords = {
    "-10": [/vix.?spike.{0,15}(3|4|5)\d/i, /circuit.?breaker/i, /halt.?trading/i],
    "-8": [/crash|plunge|meltdown|capitulation/i],
    "-6": [/bank.?run|counterparty|default|systemic|liquidation.?cascade/i],
    "-4": [/hard.?landing|recession.?confirmed|shutdown/i],
    "-3": [/war|missile|nuke|escalation|hawkish.?surprise|rate.?hike.?75|100/i],
    "+8": [/emergency.?cut|rate.?cut.?75|100/i, /qe.?restart/i],
    "+6": [/melt.?up|euphoria|fomo|parabolic/i],
    "+3": [/dovish.?surprise|fed.?pivot|stimulus/i],
    "-2": [/hot.?cpi|sticky.?inflation/i], "+2": [/cool.?cpi|disinflation/i],
    "-1": [/risk.?off|safe.?haven/i], "+1": [/risk.?on|vix.?crush/i]
};

// === Événements macro aujourd'hui (17 nov 2025 = rien de ouf, mais exemple) ===
const EVENT_MULTIPLIER = 1.0; // à passer à 1.8 les jours CPI/FOMC

const marketFilter = /stock|dow|nasdaq|s&p|spx|fed|rate|cpi|ppi|powell|vix|volatility|yield|treasury|fomc/i;

async function fetchRss(url) {
    try {
        const r = await fetch("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(url), {cache:"no-store"});
        if (!r.ok) return [];
        const d = await r.json();
        return d.items || [];
    } catch { return []; }
}

const sources = [
    "https://feeds.feedburner.com/zerohedge",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://seekingalpha.com/api/v3/news/rss?limit=50",
    "https://news.google.com/rss/search?q=when:1h+(vix+OR+spx+OR+fed+OR+powell)&hl=en-US&gl=US&ceid=US:en"
];

const MAX_ITEMS = 100;

async function fetchNews() {
    let items = [], rawScore = 0;
    for (const url of sources) {
        if (items.length >= MAX_ITEMS) break;
        const feed = await fetchRss(url);
        for (const i of feed) {
            if (items.length >= MAX_ITEMS) break;
            const title = (i.title||"").trim();
            const desc = (i.description||"").replace(/<[^>]+>/g," ").trim();
            const full = (title + " " + desc).toLowerCase();
            if (!marketFilter.test(full)) continue;

            let score = 0;
            for (const [w, patterns] of Object.entries(keywords)) {
                for (const p of patterns) if (p.test(full)) score += parseInt(w);
            }
           

            // Decay temporel (news vieille = moins d'impact)
            const ageMin = (Date.now() - Date.parse(i.pubDate || i.date || Date.now())) / 60000;
            const decay = ageMin < 15 ? 1 : ageMin < 60 ? 0.6 : ageMin < 180 ? 0.3 : 0.1;
            rawScore += score * decay;

            items.push({title, score: score*decay, ts: Date.now(), ageMin});
        }
    }

    // Lissage + multiplicateur event
    rollingScore = rollingScore === 0 ? rawScore : rollingScore * 0.8 + rawScore * 0.2;
    rollingScore *= EVENT_MULTIPLIER;

    // Historique pour le mini-graphique
    scoreHistory.push({t:Date.now(), s:rollingScore});
    if (scoreHistory.length > 200) scoreHistory.shift();
    localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(scoreHistory));

    updateUI(items);
}

function updateUI(news) {
    let stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    for (const n of news) {
        if (!stored.some(s => s.title === n.title || (s.title.includes(n.title.slice(0,50)) && n.title.includes(s.title.slice(0,50))))) {
            stored.push({title: n.title, score: n.score, ts: n.ts});
        }
    }
    stored.sort((a,b)=> b.ts - a.ts);
    if (stored.length > 200) stored = stored.slice(0,200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    newsContainer.innerHTML = stored.slice(0,50).map(n => {
        const age = Math.round((Date.now() - n.ts)/60000);
        const emoji = n.score <= -5 ? "🔴" : n.score <= -2 ? "🟠" : n.score >= 5 ? "🟢" : n.score >= 2 ? "🟡" : "⚪";
        return `<div class="news-item">${emoji} ${n.title} <small>(${age}min)</small></div>`;
    }).join("");

    // Seuils finaux (calibrés sur VIX 2022-2025)
    const s = rollingScore;
    if (s <= -16) { setSentiment("extreme-red", "VXX LONG MAXI — CRASH INCOMING"); beep(300,3); }
    else if (s <= -9) { setSentiment("red", "VXX LONG — Risk-Off violent"); beep(200,2); }
    else if (s >= 16) { setSentiment("extreme-green", "SHORT VXX GROS — Melt-Up activé"); beep(800,3); }
    else if (s >= 9) { setSentiment("green", "Risk-On — Calls SPY ou flat VXX"); }
    else { setSentiment("neutral", "CHOPPY — Scalp ou café"); }

    drawChart();
}

function setSentiment(cls, msg) {
    circle.className = `circle ${cls}`;
    sentimentText.textContent = msg;
}

// Son + vibration mobile
function beep(freq=400, repeats=1) {
    if (!("vibrate" in navigator)) return;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.value = freq; g.gain.value = 0.1;
    o.start(); o.stop(audioCtx.currentTime + 0.3);
    for(let i=0;i<repeats;i++) setTimeout(()=>navigator.vibrate([200,100,200]), i*500);
}

// Mini-graphique
function drawChart() {
    const w = 800, h = 80;
    chartCtx.clearRect(0,0,w,h);
    chartCtx.strokeStyle = "#0f0";
    chartCtx.lineWidth = 2;
    chartCtx.beginPath();
    const slice = scoreHistory.slice(-120); // 2h si refresh 60s
    slice.forEach((p,i) => {
        const x = i * w / (slice.length-1);
        const y = h/2 - (p.s / 40) * h/2; // échelle adaptative
        i===0 ? chartCtx.moveTo(x,y) : chartCtx.lineTo(x,y);
    });
    chartCtx.stroke();
}

fetchNews();
setInterval(fetchNews, 28_000); // 28s = sweet spot (pas ban rss2json)
</script>
</body></html>
