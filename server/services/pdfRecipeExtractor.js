import GeminiVisionService from './geminiVision.js';
import GroqService from './groqService.js';
import TextProcessor from './textProcessor.js';
import RenderedPdfScraper from './renderedPdfScraper.js';

export default class PdfRecipeExtractor {
  constructor() {
    this.gemini = new GeminiVisionService();
    this.groq = new GroqService();
    this.rendered = new RenderedPdfScraper();
  }

  async extractFromPdfBuffer(pdfBuffer) {
    // Rendered PDF route ONLY (page-by-page via Puppeteer)
    try {
      const rendered = await this.rendered.extractFromPdfBuffer(pdfBuffer);
      if (rendered?.success && rendered.recipe) {
        return { success: true, recipe: rendered.recipe, textLength: JSON.stringify(rendered.recipe).length };
      }
      return { success: false, error: 'No recipe detected in rendered PDF pages' };
    } catch (e) {
      return { success: false, error: `Rendered PDF extraction failed: ${e?.message || 'unknown error'}` };
    }
  }
}


