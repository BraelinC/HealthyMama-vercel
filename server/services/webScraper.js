import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Configure stealth mode
puppeteer.use(StealthPlugin());

class WebScraperService {
  // Extract JSON-LD structured data from page
  async extractJsonLd(page) {
    console.log('🔍 Checking for JSON-LD recipe schema...');
    
    const jsonLdData = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      const recipeSchemas = [];
      
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          
          // Handle single objects or arrays
          const items = Array.isArray(data) ? data : [data];
          
          for (const item of items) {
            // Check if it's a recipe schema
            if (item['@type'] === 'Recipe' || 
                (item['@graph'] && item['@graph'].some(g => g['@type'] === 'Recipe'))) {
              
              // Extract recipe from @graph if present
              const recipe = item['@type'] === 'Recipe' ? item : 
                            item['@graph'].find(g => g['@type'] === 'Recipe');
              
              if (recipe) {
                recipeSchemas.push(recipe);
              }
            }
          }
        } catch (e) {
          // Skip malformed JSON-LD
          continue;
        }
      }
      
      return recipeSchemas;
    });
    
    console.log(`📋 Found ${jsonLdData.length} JSON-LD recipe schemas`);
    return jsonLdData;
  }
  
  // Check if JSON-LD recipe data is complete
  validateRecipeCompleteness(recipeData) {
    if (!recipeData || recipeData.length === 0) {
      return { isComplete: false, reason: 'No JSON-LD recipe data found' };
    }
    
    const recipe = recipeData[0]; // Use first recipe found
    
    // Check for required fields
    const hasName = recipe.name && recipe.name.trim().length > 0;
    const hasIngredients = recipe.recipeIngredient && recipe.recipeIngredient.length > 0;
    const hasInstructions = recipe.recipeInstructions && recipe.recipeInstructions.length > 0;
    
    if (!hasName) {
      return { isComplete: false, reason: 'Missing recipe name' };
    }
    
    if (!hasIngredients) {
      return { isComplete: false, reason: 'Missing ingredients list' };
    }
    
    if (!hasInstructions) {
      return { isComplete: false, reason: 'Missing instructions' };
    }
    
    console.log('✅ JSON-LD recipe data is complete');
    return { isComplete: true, recipe };
  }
  
  // Transform JSON-LD to our format
  transformJsonLdRecipe(jsonLdRecipe) {
    const ingredients = jsonLdRecipe.recipeIngredient || [];
    const instructions = jsonLdRecipe.recipeInstructions || [];
    
    // Extract instruction text (handle different instruction formats)
    const instructionTexts = instructions.map(instruction => {
      if (typeof instruction === 'string') return instruction;
      if (instruction.text) return instruction.text;
      if (instruction.name) return instruction.name;
      return String(instruction);
    });
    
    return {
      title: jsonLdRecipe.name || 'Unknown Recipe',
      description: jsonLdRecipe.description || '',
      ingredients: ingredients,
      instructions: instructionTexts,
      image: jsonLdRecipe.image?.[0]?.url || jsonLdRecipe.image?.url || jsonLdRecipe.image,
      prepTime: jsonLdRecipe.prepTime,
      cookTime: jsonLdRecipe.cookTime,
      totalTime: jsonLdRecipe.totalTime,
      servings: jsonLdRecipe.recipeYield,
      difficulty: jsonLdRecipe.difficulty,
      cuisine: jsonLdRecipe.recipeCuisine,
      category: jsonLdRecipe.recipeCategory
    };
  }

  // Smart content loading with network idle waiting
  async smartContentLoading(page) {
    console.log('🎯 Step 1: Wait for initial page load and network to settle');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Brief initial wait
    try {
      await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 });
      console.log('✅ Network settled after initial load');
    } catch (e) {
      console.log('⏰ Network idle timeout on initial load, continuing...');
    }

    console.log('🔽 Step 2: Scroll to ingredients section and wait for content');
    await page.evaluate(() => {
      // Try to find and scroll to ingredients section
      const ingredientsSelectors = [
        '[class*="ingredient"]', '[id*="ingredient"]',
        '.recipe-ingredients', '#ingredients',
        'h2', 'h3',
        '.ingredients-section', '[data-module="ingredients"]'
      ];
      
      for (const selector of ingredientsSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log(`Found ingredients at: ${selector}`);
          return;
        }
      }
      
      // Fallback: scroll to middle of page
      window.scrollTo({ top: window.innerHeight * 1.5, behavior: 'smooth' });
    });
    
    // Wait for network to settle after scrolling
    try {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
      console.log('✅ Network settled after scrolling');
    } catch (e) {
      console.log('⏰ Network idle timeout after scrolling, continuing...');
    }

    console.log('📊 Step 3: Check if content loaded');
    const hasIngredients = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      const ingredientKeywords = ['cup', 'tablespoon', 'teaspoon', 'tsp', 'tbsp', 'flour', 'sugar', 'egg'];
      return ingredientKeywords.some(keyword => text.includes(keyword));
    });

    if (!hasIngredients) {
      console.log('❌ No ingredients found, scrolling more...');
      await page.evaluate(() => {
        window.scrollTo({ top: window.innerHeight * 2, behavior: 'smooth' });
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Try to wait for more content after additional scrolling
      try {
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 3000 });
      } catch (e) {
        console.log('⏰ No additional network activity detected');
      }
    }

    console.log('🔽 Step 4: Scroll to instructions and wait for content');
    await page.evaluate(() => {
      const instructionsSelectors = [
        '[class*="instruction"]', '[id*="instruction"]',
        '.recipe-instructions', '#instructions', '#directions',
        'h2', 'h3',
        '.instructions-section', '[data-module="instructions"]'
      ];
      
      for (const selector of instructionsSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log(`Found instructions at: ${selector}`);
          return;
        }
      }
      
      // Fallback: scroll further down
      window.scrollTo({ top: window.innerHeight * 3, behavior: 'smooth' });
    });
    
    // Wait for network to settle after scrolling to instructions
    try {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
      console.log('✅ Network settled after scrolling to instructions');
    } catch (e) {
      console.log('⏰ Network idle timeout after instructions scroll, continuing...');
    }

    console.log('📊 Step 5: Final content check');
    const contentStats = await page.evaluate(() => {
      const text = document.body.innerText;
      const ingredientCount = (text.match(/\b(cup|tablespoon|teaspoon|tsp|tbsp)\b/gi) || []).length;
      const stepCount = (text.match(/\b(step|preheat|mix|add|bake|cook)\b/gi) || []).length;
      
      return {
        textLength: text.length,
        ingredientCount,
        stepCount,
        hasRecipeContent: ingredientCount > 0 && stepCount > 0
      };
    });

    if (!contentStats.hasRecipeContent && contentStats.textLength < 1000) {
      console.log('⏰ Content still loading, waiting 5 more seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log(`✅ Smart loading complete: ${contentStats.textLength} chars, ${contentStats.ingredientCount} ingredients, ${contentStats.stepCount} steps`);
  }

  async scrapeRecipePage(url) {
    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--proxy-bypass-list=*'
      ]
    });
    
    const page = await browser.newPage();

    const navigateWithRetry = async (attempt = 1) => {
      const maxAttempts = 3;
      try {
        console.log(`🧭 Navigating to ${url} (attempt ${attempt}/${maxAttempts})`);
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (e1) {
          console.log('⚠️ domcontentloaded failed; trying commit load');
          await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
        }
      } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        const retriable = msg.includes('frame was detached') || msg.includes('navigation') || msg.includes('timeout');
        if (retriable && attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 1500 * attempt));
          return navigateWithRetry(attempt + 1);
        }
        throw e;
      }
    };

    try {
      await navigateWithRetry();
      console.log(`🔍 Scraping recipe from: ${url}`);
      
      // Set comprehensive browser headers to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set additional headers for better bot evasion
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      });
      
      // Ensure the page has any anchor rendered before proceeding
      try { await page.waitForSelector('a', { timeout: 5000 }); } catch {}

      // Set viewport to common resolution
      await page.setViewport({ width: 1366, height: 768 });
      
      // Confirm we still have a live frame (guard against SPA redirects)
      try { await page.waitForFunction('document.readyState === "complete" || document.readyState === "interactive"', { timeout: 8000 }); } catch {}
      
      console.log('🔒 Stealth mode active, enhanced headers set, waiting for content...');
      
      // METHOD 1: Fast JSON-LD Extraction (wait for common containers if present)
      console.log('🚀 Method 1: Fast JSON-LD extraction');
      const candidates = ['.post-item', '.entry-item', '.wp-block-latest-posts__post', 'article'];
      for (const sel of candidates) {
        try { await page.waitForSelector(sel, { timeout: 2500 }); break; } catch {}
      }
      
      // Try JSON-LD extraction first
      const jsonLdData = await this.extractJsonLd(page);
      const validation = this.validateRecipeCompleteness(jsonLdData);
      
      if (validation.isComplete) {
        console.log('✅ JSON-LD extraction successful - using fast method');
        
        // Still extract images for final output
        const imageUrls = await this.extractImages(page);
        const transformedRecipe = this.transformJsonLdRecipe(validation.recipe);
        
        return {
          method: 'json-ld',
          jsonLdRecipe: transformedRecipe,
          textContent: '', // Empty since we have structured data
          imageUrls,
          pdfUrls: [],
          originalUrl: url
        };
      }
      
      // METHOD 2: Enhanced HTML Scraping with Smart Scrolling
      console.log(`⚠️ JSON-LD incomplete: ${validation.reason}`);
      console.log('🔄 Method 2: Enhanced HTML scraping with smart scrolling');
      
      // Smart content loading strategy
      await this.smartContentLoading(page);
      
      // Extract text content with enhanced selectors
      const textContent = await this.extractTextContent(page);
      const imageUrls = await this.extractImages(page);
      const pdfUrls = await this.extractPdfUrls(page);
      
      console.log(`📄 Extracted ${textContent.length} characters of text`);
      console.log(`🖼️ Found ${imageUrls.length} potential recipe images`);
      console.log(`📋 Found ${pdfUrls.length} PDF documents`);
      
      return {
        method: 'html-scraping',
        textContent: textContent.trim(),
        imageUrls,
        pdfUrls,
        originalUrl: url
      };
      
    } catch (error) {
      console.error('🚨 Scraping error:', error);
      throw new Error(`Failed to scrape ${url}: ${error.message}`);
    } finally {
      await browser.close();
    }
  }
  
  // Helper method to extract images
  async extractImages(page) {
    return await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images
        .filter(img => {
          // Filter by size - recipe images are usually substantial
          if (img.naturalWidth < 200 || img.naturalHeight < 150) return false;
          
          // Filter out common non-recipe images
          const src = img.src.toLowerCase();
          const alt = (img.alt || '').toLowerCase();
          const excludePatterns = [
            'logo', 'icon', 'avatar', 'profile', 'social', 'share',
            'advertisement', 'banner', 'header', 'footer', 'sidebar'
          ];
          
          return !excludePatterns.some(pattern => 
            src.includes(pattern) || alt.includes(pattern)
          );
        })
        .map(img => img.src)
        .filter(src => src && src.startsWith('http'));
    });
  }
  
  // Helper method to extract text content
  async extractTextContent(page) {
    return await page.evaluate(() => {
      // Remove scripts, styles, and other non-content elements
      const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer, .ad, .advertisement, .social-share, .newsletter');
      elementsToRemove.forEach(el => el.remove());
      
      // Try to find recipe-specific content first
      const recipeSelectors = [
        '.recipe',
        '.recipe-content', 
        '.recipe-container',
        '.recipe-card',
        '[itemtype*="Recipe"]',
        '.post-content',
        '.entry-content',
        'main'
      ];
      
      let recipeContent = '';
      for (const selector of recipeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          recipeContent = element.innerText;
          break;
        }
      }
      
      // Fallback to body content if no recipe-specific content found
      return recipeContent || document.body.innerText;
    });
  }
  
  // Helper method to extract PDF URLs
  async extractPdfUrls(page) {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href$=".pdf"], a[href*=".pdf"]'));
      return links.map(link => link.href).filter(href => href);
    });
  }
  
  async downloadPdf(pdfUrl) {
    console.log(`📥 Downloading PDF: ${pdfUrl}`);
    
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      console.error('🚨 PDF download error:', error);
      throw error;
    }
  }
}

export default WebScraperService;