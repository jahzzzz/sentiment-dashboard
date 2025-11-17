const newsContainer = document.getElementById("news");
const circle = document.getElementById("sentiment-circle");
const sentimentText = document.getElementById("sentiment-text");

// Flux RSS gratuits
const sources = [
    "https://news.yahoo.com/rss",
    "https://www.marketwatch.com/feeds/latest-news",
    "https://www.cnbc.com/id/100727362/device/rss/rss.html"
];

// Mots-clés sentiment
const negativeWords = [
    "inflation", "war", "tensions", "crash", "fall", "drop",
    "miss", "fear", "volatile", "recession", "warning",
    "rates rise", "hawkish", "sec", "probe"
];

const positiveWords = [
    "beat", "growth", "surge", "rally", "bullish",
    "optimism", "rebound", "increase", "strong"
];

async function fetchNews() {
    let allNews = [];
    let score = 0;

    for (let url of sources) {
        try {
            let response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            let data = await response.json();
            let xml = new window.DOMParser().parseFromString(data.contents, "text/xml");

            let items = Array.from(xml.querySelectorAll("item")).slice(0, 5);

            items.forEach(item => {
                const title = item.querySelector("title").textContent;

                // Scoring automatique
                let localScore = 0;

                let t = title.toLowerCase();

                negativeWords.forEach(w => { if (t.includes(w)) localScore -= 1; });
                positiveWords.forEach(w => { if (t.includes(w)) localScore += 1; });

                allNews.push({ title, score: localScore });

                score += localScore;
            });

        } catch (err) {
            console.log("Erreur flux:", url);
        }
    }

    updateUI(allNews, score);
}

function updateUI(allNews, score) {
    newsContainer.innerHTML = "";
    
    allNews.forEach(n => {
        let color = n.score < 0 ? "red" : n.score > 0 ? "green" : "neutral";
        newsContainer.innerHTML += `
            <div class="news-item">
                <span style="color:${color === "red" ? "#ff4b4b" : color === "green" ? "#49ff75" : "#bbb"}">
                    ●
                </span>
                ${n.title}
            </div>
        `;
    });

    // SENTIMENT GLOBAL
    if (score <= -3) {
        circle.className = "circle red";
        sentimentText.textContent = "SENTIMENT : ROUGE (Risk-Off)";
        sentimentText.className = "sentiment-red";
    } else if (score >= 3) {
        circle.className = "circle green";
        sentimentText.textContent = "SENTIMENT : NOIR/RISK-ON";
        sentimentText.className = "sentiment-green";
    } else {
        circle.className = "circle neutral";
        sentimentText.textContent = "SENTIMENT : Neutre";
        sentimentText.className = "sentiment-neutral";
    }
}

// Refresh automatique toutes les 20 secondes
fetchNews();
setInterval(fetchNews, 20000);
