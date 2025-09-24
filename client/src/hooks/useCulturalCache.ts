import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

interface CulturalCacheData {
  culture: string;
  cached: boolean;
  authenticity_score: number;
  complexity: number;
  access_count: number;
  last_accessed: string;
  meals_count: number;
}

interface CacheStats {
  totalUsers: number;
  totalCuisines: number;
  cacheSize: string;
  hitRate: number;
  memoryUsageMB: number;
}

export function useCulturalCache() {
  // Get overall cache statistics
  const { data: cacheStats } = useQuery<CacheStats>({
    queryKey: ['/api/culture-cache-stats'],
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  return {
    cacheStats,
    isLoading: !cacheStats
  };
}

export function useCulturalCuisineData(cultures: string[]) {
  const [cacheData, setCacheData] = useState<CulturalCacheData[]>([]);
  const [loading, setLoading] = useState(false);

  // Stabilize the cultures array to prevent infinite loops
  const stableCultures = useMemo(() => {
    if (!cultures || cultures.length === 0) return [];
    return [...cultures];
  }, [cultures?.join(',')]);

  useEffect(() => {
    if (!stableCultures || stableCultures.length === 0) {
      setCacheData([]);
      return;
    }

    const fetchCulturalData = async () => {
      setLoading(true);
      const results: CulturalCacheData[] = [];

      for (const culture of stableCultures) {
        try {
          const response = await fetch(`/api/cultural-cuisine/${encodeURIComponent(culture)}`, {
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            results.push({
              culture,
              cached: true,
              authenticity_score: data.source_quality_score || 0.8,
              complexity: calculateComplexity(data),
              access_count: data.access_count || 0,
              last_accessed: data.last_accessed || new Date().toISOString(),
              meals_count: data.meals?.length || 0
            });
          } else {
            // Not cached or error
            results.push({
              culture,
              cached: false,
              authenticity_score: 0,
              complexity: 0,
              access_count: 0,
              last_accessed: '',
              meals_count: 0
            });
          }
        } catch (error) {
          console.error(`Error fetching cultural data for ${culture}:`, error);
          results.push({
            culture,
            cached: false,
            authenticity_score: 0,
            complexity: 0,
            access_count: 0,
            last_accessed: '',
            meals_count: 0
          });
        }
      }

      setCacheData(results);
      setLoading(false);
    };

    fetchCulturalData();
  }, [stableCultures]);

  return {
    cacheData,
    loading
  };
}

// Helper function to calculate complexity from cultural cuisine data
function calculateComplexity(data: any): number {
  if (!data || !data.meals) return 2.5;

  // Calculate average complexity from meal data
  const complexityIndicators = [
    data.meals.length > 8 ? 1 : 0, // Many meals = more complexity
    data.summary?.common_cooking_techniques?.length > 5 ? 1 : 0, // Many techniques
    data.summary?.common_healthy_ingredients?.length > 10 ? 0.5 : 0, // Many ingredients
  ];

  const baseComplexity = 2.0;
  const additionalComplexity = complexityIndicators.reduce((sum, indicator) => sum + indicator, 0);
  
  return Math.min(5, Math.max(1, baseComplexity + additionalComplexity));
}