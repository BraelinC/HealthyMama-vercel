class UrlDetectionService {
  constructor() {
    // Homepage patterns - these indicate a site's main page
    this.homepagePatterns = [
      /^https?:\/\/[^\/]+\/?$/,              // domain.com or domain.com/
      /^https?:\/\/[^\/]+\/index\.html?$/,   // domain.com/index.html
      /^https?:\/\/[^\/]+\/home\/?$/,        // domain.com/home
      /^https?:\/\/[^\/]+\/main\/?$/,        // domain.com/main
      /^https?:\/\/[^\/]+\/default\/?$/      // domain.com/default
    ];

    // Recipe page patterns - these indicate specific recipe pages
    this.recipePagePatterns = [
      /\/recipe\//i,                         // /recipe/something
      /\/recipes\//i,                        // /recipes/something  
      /\/cooking\//i,                        // /cooking/something
      /\/food\//i,                           // /food/something
      /\/dish\//i,                           // /dish/something
      /\/meal\//i,                           // /meal/something
      /\/[^\/]+-recipe\/?$/i,                // something-recipe
      /\/[^\/]+-cookies?\/?$/i,              // something-cookie(s)
      /\/[^\/]+-cake\/?$/i,                  // something-cake
      /\/[^\/]+-bread\/?$/i,                 // something-bread
      /\/[^\/]+-soup\/?$/i,                  // something-soup
      /\/[^\/]+-salad\/?$/i,                 // something-salad
      /\/[^\/]+-pasta\/?$/i,                 // something-pasta
      /\/[^\/]+-pizza\/?$/i,                 // something-pizza
      /\/[^\/]+-chicken\/?$/i,               // something-chicken
      /\/[^\/]+-beef\/?$/i,                  // something-beef
      /\/[^\/]+-fish\/?$/i,                  // something-fish
      /\/[^\/]+-dessert\/?$/i,               // something-dessert
      /\/[^\/]+-breakfast\/?$/i,             // something-breakfast
      /\/[^\/]+-lunch\/?$/i,                 // something-lunch
      /\/[^\/]+-dinner\/?$/i,                // something-dinner
      /\/[^\/]+-appetizer\/?$/i,             // something-appetizer
      /\/[^\/]+-smoothie\/?$/i,              // something-smoothie
      /\/[^\/]+-drink\/?$/i,                 // something-drink
      /\/[^\/]+-bake\/?$/i,                  // something-bake
      /\/[^\/]+-grill\/?$/i,                 // something-grill
      /\/[^\/]+-roast\/?$/i                  // something-roast
    ];

    // Category/listing patterns - these are recipe category pages, not individual recipes
    this.categoryPagePatterns = [
      /\/recipes\/?$/i,                      // /recipes (listing)
      /\/recipe-category\//i,                // /recipe-category/
      /\/categories?\//i,                    // /category/ or /categories/
      /\/cuisine\//i,                        // /cuisine/italian
      /\/diet\//i,                           // /diet/vegetarian
      /\/course\//i,                         // /course/appetizer
      /\/ingredient\//i,                     // /ingredient/chicken
      /\/tag\//i,                            // /tag/quick-meals
      /\/tags\//i,                           // /tags/easy
      /\/collection\//i,                     // /collection/holiday
      /\/search\//i,                         // /search/results
      /\/browse\//i,                         // /browse/recent
      /\/recipes\/popular\/?$/i             // common popular listing
    ];
  }

  // Main function to determine URL type
  detectUrlType(url) {
    try {
      const cleanUrl = url.trim();
      console.log(`🔍 Analyzing URL: ${cleanUrl}`);

      // Check if it's a homepage
      if (this.isHomepage(cleanUrl)) {
        console.log(`🏠 Detected: HOMEPAGE`);
        return {
          type: 'homepage',
          action: 'discovery',
          reason: 'URL matches homepage patterns'
        };
      }

      // Check if it's a category/listing page
      if (this.isCategoryPage(cleanUrl)) {
        console.log(`📋 Detected: CATEGORY PAGE`);
        return {
          type: 'category',
          action: 'discovery',
          reason: 'URL appears to be a recipe category or listing page'
        };
      }

      // Check if it's a specific recipe page
      if (this.isRecipePage(cleanUrl)) {
        console.log(`🍳 Detected: RECIPE PAGE`);
        return {
          type: 'recipe',
          action: 'extract',
          reason: 'URL matches recipe page patterns'
        };
      }

      // Default: treat as potential recipe page but with lower confidence
      console.log(`❓ Detected: UNKNOWN (treating as recipe page)`);
      return {
        type: 'unknown',
        action: 'extract',
        reason: 'URL doesn\'t match known patterns, attempting direct extraction'
      };

    } catch (error) {
      console.error('❌ URL detection error:', error);
      return {
        type: 'error',
        action: 'extract',
        reason: 'Error analyzing URL, defaulting to extraction'
      };
    }
  }

  // Check if URL is a homepage
  isHomepage(url) {
    return this.homepagePatterns.some(pattern => pattern.test(url));
  }

  // Check if URL is a specific recipe page
  isRecipePage(url) {
    return this.recipePagePatterns.some(pattern => pattern.test(url));
  }

  // Check if URL is a category/listing page
  isCategoryPage(url) {
    return this.categoryPagePatterns.some(pattern => pattern.test(url));
  }

  // Get domain from URL
  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return null;
    }
  }

  // Get path from URL
  getPath(url) {
    try {
      return new URL(url).pathname;
    } catch (e) {
      return null;
    }
  }

  // Analyze URL structure for debugging
  analyzeUrl(url) {
    try {
      const urlObj = new URL(url);
      return {
        domain: urlObj.hostname,
        path: urlObj.pathname,
        hasTrailingSlash: urlObj.pathname.endsWith('/'),
        pathSegments: urlObj.pathname.split('/').filter(seg => seg.length > 0),
        isRoot: urlObj.pathname === '/' || urlObj.pathname === '',
        hasFileExtension: /\.[a-zA-Z]{2,4}$/.test(urlObj.pathname)
      };
    } catch (e) {
      return null;
    }
  }

  // Test multiple URLs for debugging
  testUrls(urls) {
    console.log('\n🧪 URL Detection Test Results:');
    console.log('='.repeat(50));
    
    urls.forEach(url => {
      const result = this.detectUrlType(url);
      const analysis = this.analyzeUrl(url);
      
      console.log(`\nURL: ${url}`);
      console.log(`Type: ${result.type.toUpperCase()}`);
      console.log(`Action: ${result.action.toUpperCase()}`);
      console.log(`Reason: ${result.reason}`);
      if (analysis) {
        console.log(`Domain: ${analysis.domain}`);
        console.log(`Path: ${analysis.path}`);
        console.log(`Segments: [${analysis.pathSegments.join(', ')}]`);
      }
    });
    
    console.log('='.repeat(50));
  }
}

export default UrlDetectionService;