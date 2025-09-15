import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Configure stealth mode
puppeteer.use(StealthPlugin());

class UrlDiscoveryService {
  constructor() {
    this.discoveredUrls = new Set();
    this.processed = new Set();
  }

  // Main discovery method - tries multiple strategies
  async discoverRecipeUrls(homepageUrl) {
    console.log(`🔍 Starting URL discovery for: ${homepageUrl}`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    try {
      // Try multiple discovery methods in parallel
      const discoveryPromises = [
        this.discoverFromSitemap(homepageUrl),
        this.discoverFromHomepage(browser, homepageUrl),
        this.discoverFromNavigation(browser, homepageUrl)
      ];

      const results = await Promise.allSettled(discoveryPromises);
      
      // Combine results from all methods
      const allUrls = new Set();
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          result.value.forEach(url => allUrls.add(url));
          console.log(`✅ Method ${index + 1} found ${result.value.length} URLs`);
        } else {
          console.log(`⚠️ Method ${index + 1} failed: ${result.reason.message}`);
        }
      });

      const finalUrls = Array.from(allUrls);
      console.log(`🎯 Total unique recipe URLs discovered: ${finalUrls.length}`);
      
      return finalUrls;

    } catch (error) {
      console.error('🚨 URL discovery error:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  // Method 1: Try to find sitemap.xml
  async discoverFromSitemap(baseUrl) {
    console.log('📋 Method 1: Checking sitemap...');
    
    try {
      const sitemapUrls = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/recipe-sitemap.xml`,
        `${baseUrl}/wp-sitemap-posts-post-1.xml`
      ];

      for (const sitemapUrl of sitemapUrls) {
        try {
          const response = await fetch(sitemapUrl);
          if (response.ok) {
            const sitemapText = await response.text();
            const urls = this.extractUrlsFromSitemap(sitemapText);
            if (urls.length > 0) {
              console.log(`✅ Found sitemap at ${sitemapUrl} with ${urls.length} URLs`);
              return urls;
            }
          }
        } catch (e) {
          // Try next sitemap URL
        }
      }
      
      console.log('⚠️ No accessible sitemap found');
      return [];
    } catch (error) {
      console.log('⚠️ Sitemap discovery failed:', error.message);
      return [];
    }
  }

  // Method 2: Analyze homepage structure with enhanced recipe detection
  async discoverFromHomepage(browser, homepageUrl) {
    console.log('🏠 Method 2: Analyzing homepage...');
    
    const page = await browser.newPage();
    
    try {
      // Set stealth headers
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 });
      
      await page.goto(homepageUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for content to load and then scroll to load more content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Scroll down to trigger lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Scroll to bottom to load all content
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const urls = await page.evaluate((baseUrl) => {
        const recipeUrls = new Set();
        
        // Enhanced recipe URL patterns
        const recipePatterns = [
          /\/recipe\//i,
          /\/recipes\//i,
          /\/cooking\//i,
          /\/food\//i,
          /\/dish\//i,
          /\/meal\//i,
          /-recipe\/?$/i,           // ends with -recipe
          /-cookies?\/?$/i,         // ends with -cookie(s)
          /-cake\/?$/i,             // ends with -cake
          /-bread\/?$/i,            // ends with -bread
          /-soup\/?$/i,             // ends with -soup
          /-salad\/?$/i,            // ends with -salad
          /-pasta\/?$/i,            // ends with -pasta
          /-pizza\/?$/i,            // ends with -pizza
          /-chicken\/?$/i,          // ends with -chicken
          /-beef\/?$/i,             // ends with -beef
          /-dessert\/?$/i,          // ends with -dessert
          /-treats?\/?$/i,          // ends with -treat(s)
          /-smoothie\/?$/i,         // ends with -smoothie
          /-bars?\/?$/i,            // ends with -bar(s)
          /-muffins?\/?$/i,         // ends with -muffin(s)
          /-pancakes?\/?$/i,        // ends with -pancake(s)
          /-waffles?\/?$/i          // ends with -waffle(s)
        ];

        // Recipe-related text content patterns
        const recipeTextPatterns = [
          /recipe/i,
          /cook/i,
          /bake/i,
          /dish/i,
          /meal/i,
          /food/i,
          /kitchen/i,
          /ingredient/i,
          /delicious/i,
          /tasty/i,
          /yummy/i
        ];

        // Find all links on the page
        const links = Array.from(document.querySelectorAll('a[href]'));
        
        links.forEach(link => {
          const href = link.href;
          const linkText = link.textContent.toLowerCase().trim();
          const linkTitle = (link.title || '').toLowerCase();
          const linkAlt = (link.querySelector('img')?.alt || '').toLowerCase();
          
          // Check URL patterns
          const matchesUrlPattern = recipePatterns.some(pattern => pattern.test(href));
          
          // Check text content for recipe indicators
          const matchesTextPattern = recipeTextPatterns.some(pattern => 
            pattern.test(linkText) || pattern.test(linkTitle) || pattern.test(linkAlt)
          );
          
          // Additional checks for recipe-like content
          const hasRecipeKeywords = linkText.includes('recipe') || 
                                  linkText.includes('cook') || 
                                  linkText.includes('bake') ||
                                  linkTitle.includes('recipe') ||
                                  linkAlt.includes('recipe');
          
          // Include if URL pattern matches OR text suggests it's a recipe
          if (matchesUrlPattern || matchesTextPattern || hasRecipeKeywords) {
            // Ensure it's from the same domain and not obviously non-recipe
            try {
              const linkUrl = new URL(href);
              const baseUrlObj = new URL(baseUrl);
              
              if (linkUrl.hostname === baseUrlObj.hostname) {
                // Exclude obvious non-recipe pages
                const excludePatterns = [
                  /\/about/i,
                  /\/contact/i,
                  /\/privacy/i,
                  /\/terms/i,
                  /\/search/i,
                  /\/category/i,
                  /\/tag/i,
                  /\/author/i,
                  /\/wp-admin/i,
                  /\/admin/i,
                  /\.(jpg|jpeg|png|gif|pdf|doc|docx)$/i
                ];
                
                const isExcluded = excludePatterns.some(pattern => pattern.test(href));
                if (!isExcluded) {
                  recipeUrls.add(href);
                }
              }
            } catch (e) {
              // Skip invalid URLs
            }
          }
        });

        // Also look for recipe cards or structured content
        const recipeCards = document.querySelectorAll([
          '.recipe-card',
          '.recipe-item', 
          '.post-item',
          '.entry-item',
          '.food-item',
          '.dish-item',
          '[data-recipe]',
          '.wp-block-latest-posts__post'
        ].join(', '));
        
        recipeCards.forEach(card => {
          const cardLinks = card.querySelectorAll('a[href]');
          cardLinks.forEach(link => {
            const href = link.href;
            try {
              const linkUrl = new URL(href);
              const baseUrlObj = new URL(baseUrl);
              if (linkUrl.hostname === baseUrlObj.hostname) {
                recipeUrls.add(href);
              }
            } catch (e) {
              // Skip invalid URLs
            }
          });
        });

        return Array.from(recipeUrls);
      }, homepageUrl);

      console.log(`🏠 Enhanced homepage analysis found ${urls.length} potential recipe URLs`);
      return urls;

    } catch (error) {
      console.log('⚠️ Homepage analysis failed:', error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  // Method 3: Navigate through recipe sections
  async discoverFromNavigation(browser, homepageUrl) {
    console.log('🧭 Method 3: Navigation discovery...');
    
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 });
      
      await page.goto(homepageUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const urls = await page.evaluate((baseUrl) => {
        const recipeUrls = new Set();
        
        // Look for recipe category links
        const categorySelectors = [
          'a[href*="recipe"]',
          'a[href*="cooking"]',
          'a[href*="food"]',
          'nav a',
          '.menu a',
          '.navigation a',
          '.recipe-categories a',
          '.category a'
        ];

        categorySelectors.forEach(selector => {
          try {
            const links = Array.from(document.querySelectorAll(selector));
            links.forEach(link => {
              const href = link.href;
              if (href && href.includes(new URL(baseUrl).hostname)) {
                const text = link.textContent.toLowerCase();
                
                // Look for recipe-related navigation
                if (text.includes('recipe') || text.includes('cooking') || 
                    text.includes('food') || text.includes('meal') ||
                    text.includes('appetizer') || text.includes('main') ||
                    text.includes('dessert') || text.includes('breakfast')) {
                  recipeUrls.add(href);
                }
              }
            });
          } catch (e) {
            // Skip invalid selectors
          }
        });

        return Array.from(recipeUrls);
      }, homepageUrl);

      console.log(`🧭 Navigation discovery found ${urls.length} category URLs`);
      
      // TODO: Could expand this to actually visit category pages and extract recipe links
      return urls;

    } catch (error) {
      console.log('⚠️ Navigation discovery failed:', error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  // Helper: Extract URLs from sitemap XML
  extractUrlsFromSitemap(sitemapText) {
    const urls = [];
    
    // Basic XML parsing for URLs
    const urlMatches = sitemapText.match(/<loc>(.*?)<\/loc>/g);
    
    if (urlMatches) {
      urlMatches.forEach(match => {
        const url = match.replace(/<\/?loc>/g, '');
        
        // Filter for recipe-like URLs
        if (this.isRecipeUrl(url)) {
          urls.push(url);
        }
      });
    }
    
    return urls;
  }

  // Helper: Check if URL looks like a recipe
  isRecipeUrl(url) {
    const lowercaseUrl = url.toLowerCase();
    
    // Exclude common non-recipe patterns first
    const excludePatterns = [
      '/recipe-index',
      '/recipes-index', 
      '/recipe-collection',
      '/recipes-collection',
      '/recipe-ebook',
      '/recipes-ebook',
      '/holiday-recipe',
      '/about',
      '/contact',
      '/privacy',
      '/terms',
      '/category',
      '/tag',
      '/author',
      '/page/',
      '/wp-admin',
      '/wp-content',
      '.pdf',
      '.jpg',
      '.png',
      '.gif',
      '/sitemap',
      '/feed',
      '/rss'
    ];
    
    // If URL contains exclusion patterns, skip it
    if (excludePatterns.some(pattern => lowercaseUrl.includes(pattern))) {
      return false;
    }
    
    // Look for positive recipe indicators
    const recipeIndicators = [
      '/recipe/',
      '/recipes/',
      '/cooking/',
      '/food/',
      '/dish/',
      '/meal/'
    ];
    
    // Must contain at least one recipe indicator
    const hasRecipeIndicator = recipeIndicators.some(indicator => lowercaseUrl.includes(indicator));
    
    // Additional check: URL should look like a specific recipe (not just contain "recipe")
    // Good: /recipe/chicken-curry/, /recipes/pasta-salad
    // Bad: /recipe-index/, /recipes-collection/
    const looksSpecific = (
      hasRecipeIndicator && 
      (lowercaseUrl.split('/').length >= 4 || // Has path segments
       /recipe.*[a-z]{3,}/.test(lowercaseUrl)) // Contains recipe + other words
    );
    
    return looksSpecific;
  }

  // Get domain from URL
  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return null;
    }
  }
}

export default UrlDiscoveryService;