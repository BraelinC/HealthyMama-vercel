import UrlDetectionService from './urlDetectionService.js';
import UrlDiscoveryService from './urlDiscoveryService.js';
import WebScraperService from './webScraper.js';
import GeminiVisionService from './geminiVision.js';
import GroqService from './groqService.js';
import TextProcessor from './textProcessor.js';

class SmartExtractionRouter {
  constructor() {
    console.log('🏗️ [ROUTER DEBUG] SmartExtractionRouter constructor called');
    this.urlDetector = new UrlDetectionService();
    this.urlDiscovery = new UrlDiscoveryService();
    console.log('🏗️ [ROUTER DEBUG] SmartExtractionRouter initialized successfully');
  }

  // Main routing function that determines the extraction strategy
  async extractFromUrl(url, options = {}) {
    console.log(`🎯 [ROUTER DEBUG] SmartRouter: Starting extraction for ${url}`);
    console.log(`🎯 [ROUTER DEBUG] Options:`, options);
    
    try {
      // Step 1: Analyze the URL to determine type
      console.log(`🔍 [ROUTER DEBUG] Analyzing URL type...`);
      const urlAnalysis = this.urlDetector.detectUrlType(url);
      console.log(`📊 [ROUTER DEBUG] URL Analysis:`, urlAnalysis);
      console.log(`📊 [ROUTER DEBUG] URL Analysis: ${urlAnalysis.type} → ${urlAnalysis.action}`);
      console.log(`💡 [ROUTER DEBUG] Reasoning: ${urlAnalysis.reason}`);

      // Step 2: Route based on URL type
      switch (urlAnalysis.action) {
        case 'discovery':
          return await this.handleDiscoveryRoute(url, urlAnalysis, options);
        
        case 'extract':
          return await this.handleExtractionRoute(url, urlAnalysis, options);
        
        default:
          throw new Error(`Unknown action: ${urlAnalysis.action}`);
      }

    } catch (error) {
      console.error('🚨 SmartRouter error:', error);
      return {
        success: false,
        error: error.message,
        metadata: {
          originalUrl: url,
          routerError: true
        }
      };
    }
  }

  // Handle discovery route (homepages, category pages)
  async handleDiscoveryRoute(url, urlAnalysis, options) {
    console.log(`🔍 Discovery Route: Finding recipes on ${urlAnalysis.type}`);
    
    try {
      // Discover all recipe URLs from the page
      const discoveredUrls = await this.urlDiscovery.discoverRecipeUrls(url);
      
      if (discoveredUrls.length === 0) {
        return {
          success: false,
          error: 'No recipe URLs found on this page',
          metadata: {
            originalUrl: url,
            urlType: urlAnalysis.type,
            discoveredUrls: 0
          }
        };
      }

      console.log(`✅ Found ${discoveredUrls.length} recipe URLs`);

      // Limit the number of recipes to extract (default: 10 for single endpoint)
      const maxRecipes = options.maxRecipes || 10;
      const urlsToExtract = discoveredUrls.slice(0, maxRecipes);
      
      console.log(`📋 Extracting from ${urlsToExtract.length} recipe URLs`);

      // Extract recipes from discovered URLs in parallel batches
      const extractionResults = [];
      const extractionErrors = [];
      
      // Process in batches to avoid overwhelming the system
      const batchSize = 5; // 5 concurrent extractions at a time
      const batches = [];
      
      for (let i = 0; i < urlsToExtract.length; i += batchSize) {
        batches.push(urlsToExtract.slice(i, i + batchSize));
      }
      
      console.log(`🚀 Processing ${urlsToExtract.length} recipes in ${batches.length} parallel batches of ${batchSize}`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`⚡ Batch ${batchIndex + 1}/${batches.length}: Processing ${batch.length} recipes in parallel`);
        
        // Process all URLs in this batch simultaneously
        const batchPromises = batch.map(async (recipeUrl, index) => {
          const globalIndex = batchIndex * batchSize + index + 1;
          console.log(`🍳 [${globalIndex}/${urlsToExtract.length}] Starting: ${recipeUrl}`);
          
          try {
            const result = await this.extractSingleRecipe(recipeUrl);
            
            if (result.success) {
              console.log(`✅ [${globalIndex}/${urlsToExtract.length}] Success: ${result.recipe.title}`);
              return {
                success: true,
                url: recipeUrl,
                recipe: result.recipe,
                metadata: result.metadata
              };
            } else {
              console.log(`❌ [${globalIndex}/${urlsToExtract.length}] Failed: ${result.error}`);
              return {
                success: false,
                url: recipeUrl,
                error: result.error
              };
            }
          } catch (error) {
            console.log(`🚨 [${globalIndex}/${urlsToExtract.length}] Error: ${error.message}`);
            return {
              success: false,
              url: recipeUrl,
              error: error.message
            };
          }
        });
        
        // Wait for all extractions in this batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Sort results into successes and errors, filtering out invalid recipes
        batchResults.forEach(result => {
          if (result.success) {
            // Validate recipe has proper content
            const recipe = result.recipe;
            const hasValidTitle = recipe.title && recipe.title !== 'Untitled Recipe';
            const hasIngredients = recipe.ingredients && recipe.ingredients.length > 0;
            const hasInstructions = recipe.instructions && recipe.instructions.length > 0;
            
            if (hasValidTitle && hasIngredients && hasInstructions) {
              extractionResults.push({
                url: result.url,
                recipe: result.recipe,
                metadata: result.metadata
              });
            } else {
              console.log(`🚮 Filtered out invalid recipe from ${result.url}: title="${recipe.title}", ingredients=${recipe.ingredients?.length || 0}, instructions=${recipe.instructions?.length || 0}`);
              extractionErrors.push({
                url: result.url,
                error: 'Recipe missing essential content (title, ingredients, or instructions)'
              });
            }
          } else {
            extractionErrors.push({
              url: result.url,
              error: result.error
            });
          }
        });
        
        console.log(`🎯 Batch ${batchIndex + 1} complete: ${batchResults.filter(r => r.success).length}/${batch.length} successful`);
        
        // Small delay between batches to be respectful to the server
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Return results
      const successCount = extractionResults.length;
      const failureCount = extractionErrors.length;

      if (successCount === 0) {
        return {
          success: false,
          error: 'Failed to extract any recipes from discovered URLs',
          metadata: {
            originalUrl: url,
            urlType: urlAnalysis.type,
            discoveredUrls: discoveredUrls.length,
            attemptedExtractions: urlsToExtract.length,
            failures: extractionErrors
          }
        };
      }

      return {
        success: true,
        type: 'multi-recipe',
        recipes: extractionResults,
        summary: {
          originalUrl: url,
          urlType: urlAnalysis.type,
          totalDiscovered: discoveredUrls.length,
          attempted: urlsToExtract.length,
          successful: successCount,
          failed: failureCount,
          successRate: `${Math.round((successCount / urlsToExtract.length) * 100)}%`
        },
        errors: extractionErrors.length > 0 ? extractionErrors : undefined
      };

    } catch (error) {
      console.error('🚨 Discovery route error:', error);
      return {
        success: false,
        error: `Discovery failed: ${error.message}`,
        metadata: {
          originalUrl: url,
          urlType: urlAnalysis.type,
          discoveryError: true
        }
      };
    }
  }

  // Handle extraction route (specific recipe pages)
  async handleExtractionRoute(url, urlAnalysis, options) {
    console.log(`🍳 Extraction Route: Direct recipe extraction from ${urlAnalysis.type}`);
    
    try {
      const result = await this.extractSingleRecipe(url);
      
      if (result.success) {
        return {
          success: true,
          type: 'single-recipe',
          recipe: result.recipe,
          metadata: {
            ...result.metadata,
            urlType: urlAnalysis.type,
            routingReason: urlAnalysis.reason
          }
        };
      } else {
        return {
          success: false,
          error: result.error,
          metadata: {
            originalUrl: url,
            urlType: urlAnalysis.type,
            extractionError: true
          }
        };
      }

    } catch (error) {
      console.error('🚨 Extraction route error:', error);
      return {
        success: false,
        error: `Extraction failed: ${error.message}`,
        metadata: {
          originalUrl: url,
          urlType: urlAnalysis.type,
          extractionError: true
        }
      };
    }
  }

  // Single recipe extraction using our proven multi-step pipeline
  async extractSingleRecipe(url) {
    try {
      console.log(`🔧 Using multi-step extractor for: ${url}`);

      // Initialize services
      const webScraper = new WebScraperService();
      const gemini = new GeminiVisionService();
      const groq = new GroqService();

      // Step 1: Web scraping with stealth mode
      const scrapedData = await webScraper.scrapeRecipePage(url);

      let extractedRecipe;
      let mainImageUrl = '';

      if (scrapedData.method === 'json-ld') {
        // Fast JSON-LD path
        console.log(`⚡ Using fast JSON-LD extraction`);
        const imageUrls = scrapedData.imageUrls || [];
        if (imageUrls.length > 0) {
          mainImageUrl = await gemini.identifyMainRecipeImage(imageUrls);
        }

        const jsonLdText = JSON.stringify(scrapedData.jsonLdRecipe);
        extractedRecipe = await groq.extractStructuredRecipe(jsonLdText, mainImageUrl);

      } else {
        // Enhanced HTML scraping path
        console.log(`🐌 Using enhanced HTML extraction`);
        const imageUrls = scrapedData.imageUrls || [];
        let geminiResponse = null;
        
        if (imageUrls.length > 0) {
          mainImageUrl = await gemini.identifyMainRecipeImage(imageUrls);
        }

        // Text processing and extraction
        const combinedText = TextProcessor.combineTexts(
          scrapedData.textContent,
          '',
          ''
        );

        const cleanedText = TextProcessor.clean(combinedText);
        extractedRecipe = await groq.extractStructuredRecipe(cleanedText, mainImageUrl);
      }

      return {
        success: true,
        recipe: extractedRecipe,
        metadata: {
          originalUrl: url,
          extractionMethod: scrapedData.method,
          extractedImages: scrapedData.imageUrls?.length || 0,
          mainImageSelected: !!mainImageUrl,
          textLength: scrapedData.method === 'json-ld' ? 
            JSON.stringify(scrapedData.jsonLdRecipe).length :
            scrapedData.textContent.length
        }
      };

    } catch (error) {
      console.error(`🚨 Single recipe extraction error for ${url}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get URL analysis without extraction (for debugging)
  analyzeUrl(url) {
    return this.urlDetector.detectUrlType(url);
  }
}

export default SmartExtractionRouter;