import { chromium } from "playwright";
import {
  resolveColors,
  extractTypography,
  extractSpacing,
  extractRadii,
  extractShadows
} from "./extractTokens.js";
import { getFallbackTokens } from "./fallback.js";

const STYLE_PROPS = [
  "backgroundColor", "color", "fontFamily", "fontSize",
  "fontWeight", "lineHeight", "paddingTop", "paddingLeft",
  "marginTop", "marginLeft", "borderRadius", "boxShadow", "borderColor"
];

export async function scrapeSite(url) {
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    await page.route("**/*.{mp4,mp3,webm}", r => r.abort());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    const themeColor = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="theme-color"], meta[name="msapplication-TileColor"]');
      return meta ? meta.getAttribute("content") : null;
    });

    const brandElementColors = await page.evaluate(() => {
      const results = [];
      const targetSelectors = [
        'button[class*="primary"]', 'button[class*="btn-primary"]',
        'button[class*="cta"]', 'button[class*="brand"]',
        'a[class*="primary"]', 'a[class*="cta"]',
        'a[class*="sign"]', 'a[class*="join"]',
        'button', 'a[role="button"]',
        'header', 'nav', '[role="navigation"]',
        'header a', 'nav a', '[class*="logo"]', '[class*="brand"]',
        'header svg', 'nav svg',
      ];

      for (const selector of targetSelectors) {
        try {
          const els = Array.from(document.querySelectorAll(selector)).slice(0, 5);
          for (const el of els) {
            const cs = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;

            const svgEls = el.querySelectorAll('[fill]');
            for (const svg of svgEls) {
              const fill = svg.getAttribute('fill');
              if (fill && fill !== 'none' && fill !== 'currentColor') {
                results.push({ color: fill, priority: 8 });
              }
            }

            results.push({ color: cs.backgroundColor, priority: 10 });
            results.push({ color: cs.color, priority: 6 });
          }
        } catch (_) {}
      }
      return results;
    });

    const screenshotBuffer = await page.screenshot({ fullPage: false, type: "png" });

    const dominantColors = await page.evaluate(async (imgBase64) => {
      return new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        img.onload = () => {
          canvas.width  = Math.floor(img.width  / 4);
          canvas.height = Math.floor(img.height / 4);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const colorMap = {};

          for (let i = 0; i < data.length; i += 16) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a < 200) continue;

            const qr = Math.round(r / 16) * 16;
            const qg = Math.round(g / 16) * 16;
            const qb = Math.round(b / 16) * 16;

            const avg = (qr + qg + qb) / 3;
            const deviation = Math.max(Math.abs(qr-avg), Math.abs(qg-avg), Math.abs(qb-avg));
            if (avg > 220 || avg < 15 || deviation < 20) continue;

            const key = `${qr},${qg},${qb}`;
            colorMap[key] = (colorMap[key] || 0) + 1;
          }

          const sorted = Object.entries(colorMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([key]) => {
              const [r, g, b] = key.split(",").map(Number);
              return "#" + [r,g,b].map(v => v.toString(16).padStart(2,"0")).join("");
            });

          resolve(sorted);
        };

        img.onerror = () => resolve([]);
        img.src = "data:image/png;base64," + imgBase64;
      });
    }, screenshotBuffer.toString("base64"));

    const domStyles = await page.evaluate((props) => {
      const elements = Array.from(document.querySelectorAll(
        "body,h1,h2,h3,p,a,button,input,header,nav,section,footer,main"
      )).slice(0, 300);

      return elements.map(el => {
        try {
          const cs = window.getComputedStyle(el);
          const result = { tagName: el.tagName };
          for (const p of props) result[p] = cs[p] || "";
          return result;
        } catch { return { tagName: "UNKNOWN" }; }
      });
    }, STYLE_PROPS);

    const colors = resolveColors({ themeColor, brandElementColors, dominantColors, domStyles });

    return {
      colors,
      typography: extractTypography(domStyles),
      spacing:    extractSpacing(domStyles),
      radii:      extractRadii(domStyles),
      shadows:    extractShadows(domStyles),
    };

  } catch (err) {
    console.error(`Scraping failed for ${url}:`, err.message);
    return getFallbackTokens(url);
  } finally {
    if (browser) await browser.close();
  }
}