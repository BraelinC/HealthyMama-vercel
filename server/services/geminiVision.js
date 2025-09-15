import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiVisionService {
  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  }
  
  async identifyMainRecipeImage(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
      console.log('👁️ No images provided for analysis');
      return null;
    }
    
    console.log(`👁️ Analyzing ${imageUrls.length} images to find main recipe image`);
    
    const prompt = `
You are analyzing images from a recipe webpage to identify the main recipe image.

Image URLs to analyze:
${imageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

TASK: Identify which URL points to the main recipe image showing the finished dish.

CRITERIA:
- Look for images that show completed, prepared food/dishes
- Ignore logos, advertisements, social media icons, author photos, or generic stock photos  
- Ignore small thumbnails, banners, or UI elements
- Choose the most prominent image of the actual prepared recipe/meal

RESPONSE FORMAT:
Return ONLY the complete URL of the best main recipe image.
If no suitable recipe image is found, return exactly: "none"

Example good response: https://example.com/images/finished-pasta-dish.jpg
Example bad response: none
`;
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();
      
      console.log(`👁️ Gemini identified main image: ${response}`);
      
      // Validate the response is a URL from our list or "none"
      if (response === "none") {
        return null;
      }
      
      if (imageUrls.includes(response)) {
        return response;
      }
      
      // If response doesn't match exactly, try to find a partial match
      const matchedUrl = imageUrls.find(url => url.includes(response) || response.includes(url));
      return matchedUrl || null;
      
    } catch (error) {
      console.error('🚨 Gemini vision error:', error);
      // Fallback: return first image if available
      return imageUrls.length > 0 ? imageUrls[0] : null;
    }
  }
  
  async extractPdfText(pdfBuffer) {
    console.log(`👁️ Extracting text from PDF using OCR (${pdfBuffer.length} bytes)`);
    
    const prompt = `
Extract all readable text from this PDF document. 

INSTRUCTIONS:
- Extract ALL text content that is readable
- Maintain the general structure and formatting where possible
- If this is an image-only PDF with no selectable text, extract text using OCR
- If no text is found or readable, return exactly: "NO_TEXT_FOUND"

Return only the extracted text content.
`;
    
    try {
      const imagePart = {
        inlineData: {
          data: pdfBuffer.toString('base64'),
          mimeType: 'application/pdf'
        }
      };
      
      const result = await this.model.generateContent([prompt, imagePart]);
      const extractedText = result.response.text().trim();
      
      if (extractedText === "NO_TEXT_FOUND") {
        console.log('👁️ No text found in PDF');
        return '';
      }
      
      console.log(`👁️ Extracted ${extractedText.length} characters from PDF`);
      return extractedText;
      
    } catch (error) {
      console.error('🚨 PDF OCR error:', error);
      return ''; // Return empty string on error
    }
  }
  
  async analyzeRecipeImage(imageUrl) {
    console.log(`👁️ Analyzing recipe image for additional context: ${imageUrl}`);
    
    const prompt = `
Analyze this recipe image and extract any visible text or useful information.

LOOK FOR:
- Recipe names/titles visible in the image
- Ingredient lists or labels
- Cooking instructions or steps
- Any text overlays or captions
- Visual clues about the dish type, cuisine, or cooking method

RESPONSE FORMAT:
Return any extracted text or useful descriptions about what you see in the image.
If no useful text or information is visible, return: "NO_ADDITIONAL_INFO"
`;
    
    try {
      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: await this.fetchImageAsBase64(imageUrl),
            mimeType: 'image/jpeg'
          }
        }
      ]);
      
      const analysis = result.response.text().trim();
      console.log(`👁️ Image analysis result: ${analysis.substring(0, 100)}...`);
      
      return analysis === "NO_ADDITIONAL_INFO" ? '' : analysis;
      
    } catch (error) {
      console.error('🚨 Image analysis error:', error);
      return '';
    }
  }
  
  async fetchImageAsBase64(imageUrl) {
    try {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    } catch (error) {
      console.error('🚨 Image fetch error:', error);
      throw error;
    }
  }
}

export default GeminiVisionService;