const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static(__dirname));

// Test route
app.get("/", (req, res) => {
    res.send("Server is working 🚀");
});

app.get("/analyze", async (req, res) => {
    const url = req.query.url;

    if (!url) return res.status(400).json({ error: "No URL provided" });

    const visited = new Set();
    const results = [];

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();

        async function crawl(pageUrl, depth = 0) {
            if (visited.has(pageUrl) || depth > 1) return;
            visited.add(pageUrl);

            try {
                await page.goto(pageUrl, {
                    waitUntil: "domcontentloaded",
                    timeout: 20000
                });

                const data = await page.evaluate(() => {

                    function getLuminance(r,g,b){
                        const a=[r,g,b].map(v=>{
                            v/=255;
                            return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4);
                        });
                        return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2];
                    }

                    function contrast(rgb1, rgb2){
                        const lum1 = getLuminance(...rgb1);
                        const lum2 = getLuminance(...rgb2);
                        return (Math.max(lum1,lum2)+0.05)/(Math.min(lum1,lum2)+0.05);
                    }

                    function parseRGB(str){
                        const nums = str.match(/\d+/g);
                        return nums ? nums.map(Number) : [255,255,255];
                    }

                    const elements = document.querySelectorAll("p,h1,h2,h3,span");

                    return Array.from(elements).map(el => {

                        const style = getComputedStyle(el);

                        let text = el.innerText || el.textContent || "";
                        text = text.replace(/\s+/g, " ").trim();
                        if (!text) text = "[No visible text]";
                        text = text.slice(0, 80);

                        const color = parseRGB(style.color);
                        const bg = parseRGB(style.backgroundColor);

                        const contrastValue = contrast(color, bg);
                        const fontSize = parseFloat(style.fontSize);
                        const lineHeight = parseFloat(style.lineHeight);

                        let bad = false;

                        if (fontSize < 14 || contrastValue < 4.5 || lineHeight < 1.3) {
                            bad = true;

                            // Highlight
                            el.style.outline = "3px solid red";
                            el.style.backgroundColor = "rgba(255,0,0,0.1)";
                        }

                        return {
                            tag: el.tagName,
                            text,
                            fontSize: style.fontSize,
                            lineHeight: style.lineHeight,
                            fontFamily: style.fontFamily,
                            contrast: contrastValue.toFixed(2),
                            bad
                        };
                    });
                });

                results.push({
                    url: pageUrl,
                    elements: data.slice(0, 20)
                });

                // Screenshot ar highlight
                await page.screenshot({
                    path: "highlight.png",
                    fullPage: true
                });

                // Crawl vēl lapas
                const links = await page.evaluate(() =>
                    Array.from(document.querySelectorAll("a"))
                        .map(a => a.href)
                        .filter(href => href.startsWith("http"))
                );

                for (let i = 0; i < Math.min(links.length, 2); i++) {
                    await crawl(links[i], depth + 1);
                }

            } catch (err) {
                console.log("Error:", pageUrl);
            }
        }

        await crawl(url);
        await browser.close();

        res.json({ pages: results });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
