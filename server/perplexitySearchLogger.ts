import fs from 'fs/promises';
import path from 'path';

interface PerplexitySearchEntry {
  id: string;
  query: string;
  timestamp: string;
  responseSize: number;
  cached: boolean;
  category: 'cultural-cuisine' | 'meal-generation' | 'dietary-research' | 'general';
  responsePreview: string;
  fullResponse?: any;
  userId?: number;
  executionTime?: number;
}

class PerplexitySearchLogger {
  private logFile: string;
  private maxEntries: number = 1000;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB

  constructor() {
    this.logFile = path.join(__dirname, '../logs/perplexity-searches.json');
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private truncateText(text: string, maxLength: number = 200): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  async logSearch(
    query: string,
    response: any,
    category: 'cultural-cuisine' | 'meal-generation' | 'dietary-research' | 'general' = 'general',
    cached: boolean = false,
    userId?: number,
    executionTime?: number
  ): Promise<string> {
    const searchEntry: PerplexitySearchEntry = {
      id: this.generateId(),
      query: this.truncateText(query, 500),
      timestamp: new Date().toISOString(),
      responseSize: JSON.stringify(response).length,
      cached,
      category,
      responsePreview: this.extractPreview(response),
      fullResponse: response,
      userId,
      executionTime
    };

    try {
      await this.saveEntry(searchEntry);
      console.log(`📝 Logged Perplexity search: ${category} - ${this.truncateText(query, 50)}`);
      return searchEntry.id;
    } catch (error) {
      console.error('Failed to log Perplexity search:', error);
      return '';
    }
  }

  private extractPreview(response: any): string {
    if (!response) return 'Empty response';
    
    if (typeof response === 'string') {
      return this.truncateText(response, 300);
    }
    
    if (response.meals && Array.isArray(response.meals)) {
      const mealNames = response.meals.slice(0, 3).map((meal: any) => meal.name || 'Unnamed dish');
      return `Found ${response.meals.length} dishes: ${mealNames.join(', ')}${response.meals.length > 3 ? '...' : ''}`;
    }
    
    if (response.message) {
      return this.truncateText(response.message, 300);
    }
    
    if (response.content) {
      return this.truncateText(response.content, 300);
    }
    
    return this.truncateText(JSON.stringify(response), 300);
  }

  private async saveEntry(entry: PerplexitySearchEntry) {
    let existingEntries: PerplexitySearchEntry[] = [];
    
    try {
      const fileContent = await fs.readFile(this.logFile, 'utf-8');
      existingEntries = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is empty, start with empty array
      existingEntries = [];
    }

    // Add new entry at the beginning (newest first)
    existingEntries.unshift(entry);

    // Trim to max entries
    if (existingEntries.length > this.maxEntries) {
      existingEntries = existingEntries.slice(0, this.maxEntries);
    }

    // Check file size and rotate if needed
    const content = JSON.stringify(existingEntries, null, 2);
    if (content.length > this.maxFileSize) {
      await this.rotateLog();
      existingEntries = existingEntries.slice(0, Math.floor(this.maxEntries / 2)); // Keep half
    }

    await fs.writeFile(this.logFile, content, 'utf-8');
  }

  private async rotateLog() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = this.logFile.replace('.json', `-${timestamp}.json`);
    
    try {
      await fs.rename(this.logFile, rotatedFile);
      console.log(`📦 Rotated Perplexity log to: ${rotatedFile}`);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  async getSearchHistory(limit: number = 50): Promise<PerplexitySearchEntry[]> {
    try {
      const fileContent = await fs.readFile(this.logFile, 'utf-8');
      const entries: PerplexitySearchEntry[] = JSON.parse(fileContent);
      return entries.slice(0, limit);
    } catch (error) {
      console.error('Failed to read search history:', error);
      return [];
    }
  }

  async clearSearchHistory(): Promise<void> {
    try {
      await fs.writeFile(this.logFile, JSON.stringify([], null, 2), 'utf-8');
      console.log('🧹 Cleared Perplexity search history');
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }

  async getSearchStats(): Promise<{
    totalSearches: number;
    cacheHitRate: number;
    categoryCounts: Record<string, number>;
    averageResponseSize: number;
    recentSearches: number;
  }> {
    try {
      const entries = await this.getSearchHistory(1000); // Get more for stats
      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      
      const recentSearches = entries.filter(entry => 
        new Date(entry.timestamp).getTime() > twentyFourHoursAgo
      ).length;
      
      const cachedCount = entries.filter(entry => entry.cached).length;
      const cacheHitRate = entries.length > 0 ? (cachedCount / entries.length) * 100 : 0;
      
      const categoryCounts = entries.reduce((acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const averageResponseSize = entries.length > 0 
        ? entries.reduce((sum, entry) => sum + entry.responseSize, 0) / entries.length
        : 0;
      
      return {
        totalSearches: entries.length,
        cacheHitRate: Math.round(cacheHitRate),
        categoryCounts,
        averageResponseSize: Math.round(averageResponseSize),
        recentSearches
      };
    } catch (error) {
      console.error('Failed to get search stats:', error);
      return {
        totalSearches: 0,
        cacheHitRate: 0,
        categoryCounts: {},
        averageResponseSize: 0,
        recentSearches: 0
      };
    }
  }
}

// Create singleton instance
export const perplexityLogger = new PerplexitySearchLogger();

// Export helper function for easy logging
export async function logPerplexitySearch(
  query: string,
  response: any,
  category: 'cultural-cuisine' | 'meal-generation' | 'dietary-research' | 'general' = 'general',
  cached: boolean = false,
  userId?: number,
  executionTime?: number
): Promise<string> {
  return perplexityLogger.logSearch(query, response, category, cached, userId, executionTime);
}