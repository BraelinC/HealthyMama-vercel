import UrlDiscoveryService from './urlDiscoveryService.js';
import WebScraperService from './webScraper.js';
import GeminiVisionService from './geminiVision.js';
import GroqService from './groqService.js';
import TextProcessor from './textProcessor.js';

class BatchExtractionService {
  constructor() {
    this.urlDiscovery = new UrlDiscoveryService();
    this.maxWorkers = 6;
    this.activeWorkers = 0;
    this.extractionQueue = [];
    this.results = [];
    this.errors = [];
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      inProgress: 0
    };
  }

  // Main batch extraction method
  async extractRecipesFromSite(homepageUrl, maxRecipes = 50) {
    console.log(`🚀 Starting batch extraction from: ${homepageUrl}`);
    console.log(`📊 Configuration: ${this.maxWorkers} workers, max ${maxRecipes} recipes`);
    
    // Reset state
    this.results = [];
    this.errors = [];
    this.progress = { total: 0, completed: 0, failed: 0, inProgress: 0 };

    try {
      // Phase 1: Discover all recipe URLs
      console.log('📍 Phase 1: URL Discovery');
      const discoveredUrls = await this.urlDiscovery.discoverRecipeUrls(homepageUrl);
      
      if (discoveredUrls.length === 0) {
        throw new Error('No recipe URLs found on the site');
      }

      // Limit to maxRecipes if specified
      const urlsToProcess = discoveredUrls.slice(0, maxRecipes);
      this.progress.total = urlsToProcess.length;
      
      console.log(`🎯 Found ${discoveredUrls.length} URLs, processing ${urlsToProcess.length}`);

      // Phase 2: Parallel extraction
      console.log('⚡ Phase 2: Parallel Recipe Extraction');
      await this.processUrlsInParallel(urlsToProcess);

      // Phase 3: Results summary
      console.log('📊 Phase 3: Results Summary');
      const summary = this.generateSummary();
      
      return {
        success: true,
        summary,
        results: this.results,
        errors: this.errors.length > 0 ? this.errors : undefined
      };

    } catch (error) {
      console.error('🚨 Batch extraction failed:', error);
      return {
        success: false,
        error: error.message,
        partialResults: this.results.length > 0 ? this.results : undefined
      };
    }
  }

  // Process URLs using worker pool
  async processUrlsInParallel(urls) {
    return new Promise((resolve) => {
      this.extractionQueue = [...urls];
      
      // Start worker pool
      const workers = [];
      for (let i = 0; i < Math.min(this.maxWorkers, urls.length); i++) {
        workers.push(this.startWorker(i + 1));
      }

      // Monitor completion
      const checkCompletion = () => {
        if (this.progress.completed + this.progress.failed >= this.progress.total) {
          console.log('✅ All extractions completed');
          resolve();
        } else {
          setTimeout(checkCompletion, 1000);
        }
      };

      checkCompletion();
    });
  }

  // Individual worker process
  async startWorker(workerId) {
    console.log(`🔧 Worker ${workerId} started`);
    
    while (this.extractionQueue.length > 0) {
      const url = this.extractionQueue.shift();
      if (!url) break;

      this.activeWorkers++;
      this.progress.inProgress++;
      
      console.log(`👷 Worker ${workerId} processing: ${url}`);
      console.log(`📊 Progress: ${this.progress.completed}/${this.progress.total} completed, ${this.progress.inProgress} in progress`);

      try {
        // Use the existing single-recipe extraction system
        const result = await this.extractSingleRecipe(url);
        
        if (result.success) {
          this.results.push({
            url,
            recipe: result.recipe,
            metadata: result.metadata,
            extractedAt: new Date().toISOString(),
            workerId
          });
          this.progress.completed++;
          console.log(`✅ Worker ${workerId} completed: ${result.recipe.title}`);
        } else {
          this.errors.push({
            url,
            error: result.error || 'Unknown extraction error',
            workerId,
            failedAt: new Date().toISOString()
          });
          this.progress.failed++;
          console.log(`❌ Worker ${workerId} failed: ${url}`);
        }

      } catch (error) {
        this.errors.push({
          url,
          error: error.message,
          workerId,
          failedAt: new Date().toISOString()
        });
        this.progress.failed++;
        console.log(`🚨 Worker ${workerId} error: ${error.message}`);
      }

      this.activeWorkers--;
      this.progress.inProgress--;
      
      // Add delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    }

    console.log(`🏁 Worker ${workerId} finished`);
  }

  // Use the existing extraction system for each recipe
  async extractSingleRecipe(url) {
    try {
      // Initialize services (same as the existing system)
      const webScraper = new WebScraperService();
      const gemini = new GeminiVisionService();
      const groq = new GroqService();
      const textProcessor = new TextProcessor();

      // Step 1: Web scraping (using existing stealth system)
      const scrapedData = await webScraper.scrapeRecipePage(url);

      let extractedRecipe;
      let mainImageUrl = '';

      if (scrapedData.method === 'json-ld') {
        // Fast JSON-LD path
        const imageUrls = scrapedData.imageUrls || [];
        if (imageUrls.length > 0) {
          const geminiResponse = await gemini.analyzeImages(imageUrls);
          mainImageUrl = geminiResponse.mainImageUrl || imageUrls[0];
        }

        const jsonLdText = JSON.stringify(scrapedData.jsonLdRecipe);
        extractedRecipe = await groq.extractStructuredRecipe(jsonLdText, mainImageUrl);

      } else {
        // Enhanced HTML scraping path
        const imageUrls = scrapedData.imageUrls || [];
        let geminiResponse = null;
        
        if (imageUrls.length > 0) {
          geminiResponse = await gemini.analyzeImages(imageUrls);
          mainImageUrl = geminiResponse.mainImageUrl || imageUrls[0];
        }

        // Text processing and extraction
        const combinedText = textProcessor.combineTexts(
          scrapedData.textContent,
          '',
          geminiResponse?.extractedText || ''
        );

        const cleanedText = textProcessor.cleanText(combinedText);
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
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate extraction summary
  generateSummary() {
    const total = this.progress.total;
    const completed = this.progress.completed;
    const failed = this.progress.failed;
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    return {
      totalUrls: total,
      successfulExtractions: completed,
      failedExtractions: failed,
      successRate: `${successRate}%`,
      averageIngredients: this.calculateAverageIngredients(),
      extractionMethods: this.countExtractionMethods(),
      topFailureReasons: this.getTopFailureReasons()
    };
  }

  calculateAverageIngredients() {
    if (this.results.length === 0) return 0;
    
    const totalIngredients = this.results.reduce((sum, result) => {
      return sum + (result.recipe.ingredients?.length || 0);
    }, 0);
    
    return (totalIngredients / this.results.length).toFixed(1);
  }

  countExtractionMethods() {
    const methods = {};
    this.results.forEach(result => {
      const method = result.metadata.extractionMethod;
      methods[method] = (methods[method] || 0) + 1;
    });
    return methods;
  }

  getTopFailureReasons() {
    const reasons = {};
    this.errors.forEach(error => {
      const reason = error.error;
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    
    // Return top 3 failure reasons
    return Object.entries(reasons)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([reason, count]) => ({ reason, count }));
  }

  // Get current progress
  getProgress() {
    return {
      ...this.progress,
      successRate: this.progress.total > 0 ? 
        ((this.progress.completed / this.progress.total) * 100).toFixed(1) + '%' : '0%'
    };
  }
}

export default BatchExtractionService;