import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Brain, Search, ChefHat, Lightbulb, Clock, Users, Loader2 } from 'lucide-react';

interface RecipeSearchResult {
  query: string;
  totalMatches: number;
  recipes: Array<{
    content: string;
    metadata?: {
      type?: string;
      creatorId?: string;
      cuisine?: string;
      prepTime?: string;
      difficulty?: string;
      imageUrl?: string;
    };
  }>;
  modifications: string;
  userContext: Array<{
    content: string;
    metadata?: {
      type?: string;
      importance?: number;
    };
  }>;
  reasoning: string;
}

interface FeedbackData {
  recipeId: string;
  recipeTitle: string;
  cuisine?: string;
  rating: number;
  liked: boolean;
  madeSuccessfully?: boolean;
  wouldMakeAgain?: boolean;
  notes?: string;
  modifications?: string;
  issues?: string;
  likedIngredients?: string[];
  dislikedIngredients?: string[];
}

export default function RecipeIntelligence() {
  const [query, setQuery] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [results, setResults] = useState<RecipeSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [feedback, setFeedback] = useState<Partial<FeedbackData>>({
    rating: 5,
    liked: true
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('auth_token')}`
  };

  const searchRecipes = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/mem0/recipes/search', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          query: query.trim(),
          creatorId: creatorId.trim() || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Recipe search error:', error);
      alert(`Search failed: ${error.message}`);
    }
    setLoading(false);
  };

  const submitFeedback = async () => {
    if (!feedback.recipeId || !feedback.recipeTitle) {
      alert('Please provide recipe ID and title');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const response = await fetch('/api/mem0/recipes/feedback', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          recipeId: feedback.recipeId,
          feedback: feedback
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Feedback stored:', result);

      // Reset feedback form
      setFeedback({ rating: 5, liked: true });
      alert('Feedback stored successfully! UltraThink will learn from your experience.');
    } catch (error) {
      console.error('Feedback error:', error);
      alert(`Failed to store feedback: ${error.message}`);
    }
    setSubmittingFeedback(false);
  };

  const formatRecipeContent = (content: string): { title: string; details: string } => {
    const lines = content.split('\n');
    const title = lines.find(line => line.includes('Recipe:') || line.includes('Title:')) || content.slice(0, 100);
    const details = content.slice(0, 300);

    return {
      title: title.replace(/^(Recipe:|Title:)\s*/, '').trim(),
      details: details + (content.length > 300 ? '...' : '')
    };
  };

  const getContextSummary = (userContext: Array<any>): {
    restrictions: string[],
    preferences: string[],
    goals: string[]
  } => {
    const restrictions: string[] = [];
    const preferences: string[] = [];
    const goals: string[] = [];

    userContext.forEach(ctx => {
      const content = ctx.content.toLowerCase();
      if (content.includes('dietary restriction') || content.includes('allerg')) {
        restrictions.push(ctx.content.slice(0, 50));
      } else if (content.includes('preference') || content.includes('like')) {
        preferences.push(ctx.content.slice(0, 50));
      } else if (content.includes('goal')) {
        goals.push(ctx.content.slice(0, 50));
      }
    });

    return { restrictions, preferences, goals };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="text-purple-500" />
            Recipe Intelligence
            <Badge variant="outline" className="ml-2">UltraThink Powered</Badge>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Search for recipes with AI-powered personalization and intelligent substitutions based on your preferences.
          </p>
        </CardHeader>
      </Card>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search size={18} />
            Smart Recipe Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">
                What are you looking for?
              </label>
              <input
                placeholder="e.g., 'chicken noodle soup', 'spicy Asian noodles', 'healthy breakfast'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchRecipes()}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Specific Creator ID (optional)
              </label>
              <input
                placeholder="Leave empty to search all creators"
                value={creatorId}
                onChange={(e) => setCreatorId(e.target.value)}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <Button
            onClick={searchRecipes}
            disabled={loading || !query.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Searching with AI...
              </>
            ) : (
              <>
                <Brain size={16} className="mr-2" />
                Search with UltraThink
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <div className="space-y-4">
          {/* Search Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ChefHat size={18} />
                Search Results
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Query: "{results.query}"</span>
                <Badge variant="secondary">{results.totalMatches} matches</Badge>
                {creatorId && <Badge variant="outline">Creator: {creatorId}</Badge>}
              </div>
            </CardHeader>
          </Card>

          {/* Found Recipes */}
          {results.recipes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search size={16} />
                  Found Recipes ({results.recipes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {results.recipes.map((recipe, idx) => {
                  const { title, details } = formatRecipeContent(recipe.content);

                  return (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-lg">{title}</h4>
                        <div className="flex gap-2">
                          {recipe.metadata?.cuisine && (
                            <Badge variant="secondary">{recipe.metadata.cuisine}</Badge>
                          )}
                          {recipe.metadata?.difficulty && (
                            <Badge variant="outline">{recipe.metadata.difficulty}</Badge>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 mb-3">{details}</p>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {recipe.metadata?.prepTime && (
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            {recipe.metadata.prepTime}
                          </div>
                        )}
                        {recipe.metadata?.creatorId && (
                          <div className="flex items-center gap-1">
                            <Users size={12} />
                            Creator: {recipe.metadata.creatorId}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* AI Modifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="text-yellow-500" />
                AI-Powered Modifications
              </CardTitle>
              <p className="text-sm text-gray-600">
                Personalized suggestions based on your dietary preferences and cooking history
              </p>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="whitespace-pre-line text-sm leading-relaxed">
                  {results.modifications}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Context */}
          {results.userContext.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain size={16} className="text-purple-500" />
                  Your Personal Context
                </CardTitle>
                <p className="text-sm text-gray-600">
                  How UltraThink knows your preferences
                </p>
              </CardHeader>
              <CardContent>
                {(() => {
                  const { restrictions, preferences, goals } = getContextSummary(results.userContext);

                  return (
                    <div className="space-y-4">
                      {restrictions.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2 text-red-700">Dietary Restrictions:</h4>
                          <div className="space-y-1">
                            {restrictions.map((restriction, idx) => (
                              <div key={idx} className="text-xs p-2 bg-red-50 rounded border border-red-200">
                                {restriction}...
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {preferences.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2 text-green-700">Preferences:</h4>
                          <div className="space-y-1">
                            {preferences.map((pref, idx) => (
                              <div key={idx} className="text-xs p-2 bg-green-50 rounded border border-green-200">
                                {pref}...
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {goals.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2 text-blue-700">Goals:</h4>
                          <div className="space-y-1">
                            {goals.map((goal, idx) => (
                              <div key={idx} className="text-xs p-2 bg-blue-50 rounded border border-blue-200">
                                {goal}...
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Feedback Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb size={16} />
              Recipe Feedback
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFeedbackMode(!feedbackMode)}
            >
              {feedbackMode ? 'Hide' : 'Give Feedback'}
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            Help UltraThink learn from your cooking experiences
          </p>
        </CardHeader>

        {feedbackMode && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Recipe ID</label>
                <input
                  placeholder="Recipe identifier"
                  value={feedback.recipeId || ''}
                  onChange={(e) => setFeedback(prev => ({ ...prev, recipeId: e.target.value }))}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Recipe Title</label>
                <input
                  placeholder="Name of the recipe"
                  value={feedback.recipeTitle || ''}
                  onChange={(e) => setFeedback(prev => ({ ...prev, recipeTitle: e.target.value }))}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Rating (1-5)</label>
                <select
                  value={feedback.rating || 5}
                  onChange={(e) => setFeedback(prev => ({ ...prev, rating: parseInt(e.target.value) }))}
                  className="w-full p-2 border rounded"
                >
                  <option value={5}>5 - Excellent</option>
                  <option value={4}>4 - Good</option>
                  <option value={3}>3 - Average</option>
                  <option value={2}>2 - Poor</option>
                  <option value={1}>1 - Terrible</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Liked it?</label>
                <select
                  value={feedback.liked ? 'yes' : 'no'}
                  onChange={(e) => setFeedback(prev => ({ ...prev, liked: e.target.value === 'yes' }))}
                  className="w-full p-2 border rounded"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Cuisine</label>
                <input
                  placeholder="e.g., Italian, Thai"
                  value={feedback.cuisine || ''}
                  onChange={(e) => setFeedback(prev => ({ ...prev, cuisine: e.target.value }))}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Notes & Modifications</label>
              <textarea
                placeholder="What did you think? What changes did you make?"
                value={feedback.notes || ''}
                onChange={(e) => setFeedback(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full p-2 border rounded h-20"
              />
            </div>

            <Button
              onClick={submitFeedback}
              disabled={submittingFeedback || !feedback.recipeId || !feedback.recipeTitle}
              className="w-full"
            >
              {submittingFeedback ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Storing Feedback...
                </>
              ) : (
                <>
                  <Brain size={16} className="mr-2" />
                  Store Feedback in UltraThink
                </>
              )}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}