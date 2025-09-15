import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Search, Clock, ExternalLink, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PerplexitySearchEntry {
  id: string;
  query: string;
  timestamp: string;
  responseSize: number;
  cached: boolean;
  category: 'cultural-cuisine' | 'meal-generation' | 'dietary-research' | 'general';
  responsePreview: string;
  fullResponse?: any;
}

interface PerplexityCacheViewerProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export default function PerplexityCacheViewer({ isVisible, onToggleVisibility }: PerplexityCacheViewerProps) {
  const [searchHistory, setSearchHistory] = useState<PerplexitySearchEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const { toast } = useToast();

  // Load search history from localStorage and server
  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    setIsLoading(true);
    try {
      // Load from localStorage first
      const localHistory = localStorage.getItem('perplexity-search-history');
      const localEntries: PerplexitySearchEntry[] = localHistory ? JSON.parse(localHistory) : [];

      // Load from server cache
      const response = await fetch('/api/perplexity-cache');
      const serverEntries = response.ok ? await response.json() : [];

      // Merge and deduplicate
      const allEntries = [...localEntries, ...serverEntries];
      const uniqueEntries = allEntries.filter((entry, index, arr) => 
        arr.findIndex(e => e.id === entry.id) === index
      );

      // Sort by timestamp (newest first)
      uniqueEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setSearchHistory(uniqueEntries);
    } catch (error) {
      console.error('Failed to load search history:', error);
      toast({
        title: "Cache Load Failed",
        description: "Could not load Perplexity search history.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      // Clear localStorage
      localStorage.removeItem('perplexity-search-history');
      
      // Clear server cache
      await fetch('/api/perplexity-cache', { method: 'DELETE' });
      
      setSearchHistory([]);
      setSelectedEntry(null);
      
      toast({
        title: "Cache Cleared",
        description: "All Perplexity search history has been cleared."
      });
    } catch (error) {
      toast({
        title: "Clear Failed",
        description: "Could not clear cache completely.",
        variant: "destructive"
      });
    }
  };

  const refreshCache = async () => {
    await loadSearchHistory();
    toast({
      title: "Cache Refreshed",
      description: "Search history has been reloaded."
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'cultural-cuisine': return 'bg-emerald-100 text-emerald-800';
      case 'meal-generation': return 'bg-blue-100 text-blue-800';
      case 'dietary-research': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatResponseSize = (size: number) => {
    if (size < 1000) return `${size}B`;
    if (size < 1000000) return `${(size / 1000).toFixed(1)}KB`;
    return `${(size / 1000000).toFixed(1)}MB`;
  };

  if (!isVisible) {
    return (
      <Button
        onClick={onToggleVisibility}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 shadow-lg"
      >
        <Eye className="h-4 w-4 mr-2" />
        Show Perplexity Cache
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 z-50 shadow-2xl border-2 border-purple-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-purple-600" />
            Perplexity Search Cache
          </div>
          <Button
            onClick={onToggleVisibility}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <EyeOff className="h-3 w-3" />
          </Button>
        </CardTitle>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-600">
            {searchHistory.length} searches cached
          </div>
          <div className="flex gap-1">
            <Button
              onClick={refreshCache}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              title="Refresh cache"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button
              onClick={clearCache}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
              title="Clear cache"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Loading search history...
          </div>
        ) : searchHistory.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No Perplexity searches cached yet
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {searchHistory.map((entry, index) => (
              <div key={entry.id || index} className="space-y-2">
                <div 
                  className={`p-2 rounded border cursor-pointer transition-colors ${
                    selectedEntry === entry.id ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">
                        {entry.query}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-xs ${getCategoryColor(entry.category)}`}>
                          {entry.category.replace('-', ' ')}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(entry.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-xs text-gray-500">
                      <div>{formatResponseSize(entry.responseSize)}</div>
                      {entry.cached && (
                        <div className="text-green-600 font-medium">cached</div>
                      )}
                    </div>
                  </div>
                  
                  {selectedEntry === entry.id && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-600 mb-2">Response Preview:</div>
                      <div className="text-xs text-gray-800 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                        {entry.responsePreview}
                      </div>
                      {entry.fullResponse && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Full Perplexity Response:', entry.fullResponse);
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Full Response
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {index < searchHistory.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}