import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import GroqService from './groqService.js';
import { bufferToOpenableUrl } from './pdfOpenUrlService.js';

puppeteer.use(StealthPlugin());

export default class RenderedPdfScraper {
  constructor() {
    this.groq = new GroqService();
  }

  async extractFromPdfBuffer(pdfBuffer) {
    const { url } = await bufferToOpenableUrl(pdfBuffer);
    return await this.extractFromPdfUrl(url);
  }

  async extractFromPdfUrl(pdfUrl) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    const logs = [];
    const log = (msg) => { try { console.log(msg); } catch {} logs.push(String(msg)); };
    try {
      log(`[PDF] Opening URL: ${pdfUrl.slice(0, 120)}...`);
      await page.goto(pdfUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      log('[PDF] domcontentloaded');

      // Wait for any canvas (PDF viewer) to render
      try {
        await page.waitForSelector('canvas', { timeout: 8000 });
        log('[PDF] Found at least one canvas');
      } catch (e) {
        log(`[PDF] No canvas found within 8s: ${e?.message || ''}`);
      }

      // Scroll through the viewer to force lazy-loaded pages to render
      try {
        log('[PDF] Scrolling to render lazy pages');
        for (let i = 0; i < 20; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await page.waitForTimeout(400);
        }
        // Return to top
        await page.evaluate(() => window.scrollTo({ top: 0 }));
        await page.waitForTimeout(300);
      } catch {}

      // Collect all canvases after scrolling
      const canvasHandles = await page.$$('canvas');
      log(`[PDF] Total canvases detected: ${canvasHandles.length}`);
      const results = [];

      // Sample every 5 pages (and ensure first page is included)
      const total = canvasHandles.length;
      const indices = new Set([0]);
      for (let i = 0; i < total; i += 5) indices.add(i);
      log(`[PDF] Sampling page indices: ${Array.from(indices).join(', ')}`);

      for (const i of Array.from(indices).filter(i => i < total)) {
        const canvas = canvasHandles[i];
        try {
          const clip = await canvas.boundingBox();
          if (!clip) {
            log(`[PDF] Page ${i}: no bounding box`);
            continue;
          }
          if (clip.width < 100 || clip.height < 100) {
            log(`[PDF] Page ${i}: too small (${clip.width}x${clip.height})`);
            continue;
          }
          log(`[PDF] Page ${i}: bbox ${clip.width}x${clip.height}`);
          const screenshot = await canvas.screenshot({ encoding: 'base64' });
          log(`[PDF] Page ${i}: screenshot base64 length ${screenshot.length}`);

          // Send the screenshot to Groq text extractor prompt (image-assisted)
          const prompt = `Extract a recipe from this page image if present. Return JSON with keys: title, ingredients[], instructions[]. If no recipe, return exactly {\"title\":\"\",\"ingredients\":[],\"instructions\":[]}.`;
          const structured = await this.groq.extractStructuredRecipeFromImage(screenshot, prompt);
          if (structured && structured.title && structured.ingredients?.length && structured.instructions?.length) {
            log(`[PDF] Page ${i}: recipe detected (title=${structured.title})`);
            results.push(structured);
          } else {
            log(`[PDF] Page ${i}: no recipe detected`);
          }
        } catch {}
      }

      if (results.length > 0) {
        // Return the first good recipe (or enhance to merge)
        log(`[PDF] Detected ${results.length} recipe page(s), returning first`);
        return { success: true, recipe: results[0], all: results, logs };
      }
      log('[PDF] No recipe detected in sampled pages');
      return { success: false, error: 'No recipe detected on rendered pages', logs };
    } finally {
      await browser.close();
    }
  }
}


