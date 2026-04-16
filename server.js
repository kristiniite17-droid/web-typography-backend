const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.send("Server is working 🚀");
});

app.get("/analyze", async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({ error: "No URL provided" });
    }

    try {
        const browser = await puppeteer.launch({
          headless: "new",
          executablePath: puppeteer.executablePath(), // 🔥 automātiski atrod Chrome
          args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        const data = await page.evaluate(() => {
            const elements = document.querySelectorAll("p,h1,h2,h3,span");

            return Array.from(elements).map(el => {
                const style = getComputedStyle(el);

                let text = el.innerText || "";
                text = text.replace(/\s+/g, " ").trim();
                if (!text) text = "[No text]";
                text = text.slice(0, 60);

                return {
                    tag: el.tagName,
                    text,
                    fontSize: style.fontSize,
                    lineHeight: style.lineHeight
                };
            });
        });

        await browser.close();

        res.json({ elements: data.slice(0, 20) });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
