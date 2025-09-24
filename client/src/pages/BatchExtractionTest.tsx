import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Clock, Globe } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface BatchResult {
  success: boolean;
  summary?: {
    totalUrls: number;
    successfulExtractions: number;
    failedExtractions: number;
    successRate: string;
    averageIngredients: string;
    extractionMethods: Record<string, number>;
  };
  results?: Array<{
    url: string;
    recipe: {
      title: string;
      ingredients: any[];
      instructions: any[];
    };
    workerId: number;
  }>;
  error?: string;
}

export default function BatchExtractionTest() {
  const [homepageUrl, setHomepageUrl] = useState('https://mymessykitchenn.com/');
  const [maxRecipes, setMaxRecipes] = useState(10);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  const startBatchExtraction = async () => {
    setIsExtracting(true);
    setResult(null);

    try {
      console.log(`🚀 Starting batch extraction from: ${homepageUrl}`);
      
      const response = await apiRequest('/api/batch-extract-recipes', {
        method: 'POST',
        body: JSON.stringify({
          homepageUrl,
          maxRecipes
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('📊 Batch extraction result:', data);
      setResult(data);

    } catch (error) {
      console.error('🚨 Batch extraction error:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Batch Recipe Extraction</h1>
          <p className="text-gray-600">Extract multiple recipes from any recipe website automatically</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Enter a recipe website homepage to discover and extract all recipes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website Homepage URL
              </label>
              <Input
                type="url"
                placeholder="https://example.com/"
                value={homepageUrl}
                onChange={(e) => setHomepageUrl(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Recipes
              </label>
              <Input
                type="number"
                min="1"
                max="100"
                value={maxRecipes}
                onChange={(e) => setMaxRecipes(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <Button 
              onClick={startBatchExtraction}
              disabled={isExtracting || !homepageUrl}
              className="w-full"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extracting Recipes...
                </>
              ) : (
                'Start Batch Extraction'
              )}
            </Button>
          </CardContent>
        </Card>

        {isExtracting && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <div className="text-center">
                  <p className="font-medium">Batch extraction in progress...</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Discovering URLs → Parallel extraction with 6 workers → Results compilation
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                Extraction Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.success && result.summary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{result.summary.totalUrls}</div>
                      <div className="text-sm text-blue-800">URLs Found</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{result.summary.successfulExtractions}</div>
                      <div className="text-sm text-green-800">Successful</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{result.summary.failedExtractions}</div>
                      <div className="text-sm text-red-800">Failed</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{result.summary.successRate}</div>
                      <div className="text-sm text-purple-800">Success Rate</div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Extracted Recipes</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {result.results?.map((item, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{item.recipe.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {item.recipe.ingredients.length} ingredients, {item.recipe.instructions.length} steps
                              </p>
                              <p className="text-xs text-gray-500 mt-1 break-all">{item.url}</p>
                            </div>
                            <div className="ml-4 text-xs text-gray-500">
                              Worker {item.workerId}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {Object.keys(result.summary.extractionMethods).length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Extraction Methods Used</h4>
                      <div className="space-y-1">
                        {Object.entries(result.summary.extractionMethods).map(([method, count]) => (
                          <div key={method} className="flex justify-between text-sm">
                            <span className="capitalize">{method.replace('-', ' ')}</span>
                            <span>{count} recipes</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <h3 className="font-medium text-red-900 mb-1">Extraction Failed</h3>
                  <p className="text-red-700">{result.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="bg-blue-50">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm text-blue-800">
              <h4 className="font-medium">How Batch Extraction Works:</h4>
              <ul className="space-y-1 ml-4">
                <li>• <strong>URL Discovery:</strong> Finds all recipe URLs using sitemap, homepage analysis, and navigation crawling</li>
                <li>• <strong>Parallel Processing:</strong> 6 concurrent workers extract recipes using proven stealth technology</li>
                <li>• <strong>Smart Rate Limiting:</strong> Respectful delays between requests to avoid overloading servers</li>
                <li>• <strong>Comprehensive Results:</strong> Detailed success/failure tracking with extraction analytics</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}