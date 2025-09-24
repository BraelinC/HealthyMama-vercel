import { Heart, Users, Clock, DollarSign, ChefHat, Star, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MealPlanShareCardProps {
  plan: {
    id: number;
    title: string;
    description?: string;
    preview_images: string[];
    tags: string[];
    metrics: {
      cost_per_serving: number;
      total_prep_time: number;
      average_difficulty: number;
      nutrition_score: number;
      total_calories: number;
      total_recipes: number;
    };
    likes: number;
    tries: number;
    success_rate?: number;
    sharer_id: string;
    created_at: string;
  };
  onLike?: () => void;
  onTry?: () => void;
  onView?: () => void;
  isAuthenticated?: boolean;
}

export default function MealPlanShareCard({ 
  plan, 
  onLike, 
  onTry, 
  onView,
  isAuthenticated 
}: MealPlanShareCardProps) {
  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 2) return "Easy";
    if (difficulty <= 3) return "Medium";
    if (difficulty <= 4) return "Hard";
    return "Expert";
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return "text-green-600 bg-green-100";
    if (difficulty <= 3) return "text-yellow-600 bg-yellow-100";
    if (difficulty <= 4) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      {/* Preview Images */}
      <div className="relative h-48 bg-gray-100 rounded-t-lg overflow-hidden">
        {plan.preview_images && plan.preview_images.length > 0 ? (
          <div className="grid grid-cols-3 gap-0.5 h-full">
            {plan.preview_images.slice(0, 3).map((image, index) => (
              <div key={index} className="relative h-full">
                <img 
                  src={image} 
                  alt={`Recipe ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {index === 2 && plan.metrics.total_recipes > 3 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-semibold">
                      +{plan.metrics.total_recipes - 3} more
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat className="w-16 h-16 text-gray-400" />
          </div>
        )}
        
        {/* Success Rate Badge */}
        {plan.success_rate && plan.success_rate > 0 && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-500 text-white">
              <CheckCircle className="w-3 h-3 mr-1" />
              {plan.success_rate}% Success
            </Badge>
          </div>
        )}
      </div>

      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">{plan.title}</CardTitle>
            <p className="text-xs text-gray-500 mt-1">{formatDate(plan.created_at)}</p>
          </div>
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {plan.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {plan.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{plan.tags.length - 3}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {plan.description && (
          <CardDescription className="line-clamp-2 mb-3">
            {plan.description}
          </CardDescription>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-1.5 text-sm">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-medium">${plan.metrics.cost_per_serving}</span>
            <span className="text-gray-500">/serving</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-medium">{plan.metrics.total_prep_time}</span>
            <span className="text-gray-500">min total</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Badge className={`${getDifficultyColor(plan.metrics.average_difficulty)} text-xs`}>
              {getDifficultyLabel(plan.metrics.average_difficulty)}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <ChefHat className="w-4 h-4 text-purple-600" />
            <span className="font-medium">{plan.metrics.total_recipes}</span>
            <span className="text-gray-500">recipes</span>
          </div>
        </div>

        {/* Nutrition Score */}
        {plan.metrics.nutrition_score > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">Nutrition Score</span>
              <span className="font-medium">{plan.metrics.nutrition_score}/100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-emerald-500 h-2 rounded-full"
                style={{ width: `${plan.metrics.nutrition_score}%` }}
              />
            </div>
          </div>
        )}

        {/* Engagement Stats */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-sm">
            <button 
              onClick={onLike}
              className="flex items-center gap-1 hover:text-red-600 transition-colors"
            >
              <Heart className="w-4 h-4" />
              <span>{plan.likes}</span>
            </button>
            <div className="flex items-center gap-1 text-gray-600">
              <Users className="w-4 h-4" />
              <span>{plan.tries} tried</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isAuthenticated && (
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1"
              onClick={onTry}
            >
              Try This Plan
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="flex-1"
              onClick={onView}
            >
              View Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}