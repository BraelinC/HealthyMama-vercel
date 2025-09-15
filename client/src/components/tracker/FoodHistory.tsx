import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { safeApiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface FoodLog {
  id: number;
  foods: any[];
  total_calories: number;
  total_protein?: number;
  total_carbs?: number;
  total_fat?: number;
  meal_type?: string;
  logged_at: string;
}

interface FoodHistoryProps {
  logs: FoodLog[];
}

export default function FoodHistory({ logs }: FoodHistoryProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (logId: number) => {
    try {
      await safeApiRequest(`/api/food-logs/${logId}`, {
        method: 'DELETE'
      });
      
      // Refresh the logs
      queryClient.invalidateQueries({ queryKey: ['/api/food-logs/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/food-logs/week'] });
      
      toast({
        title: "Deleted",
        description: "Food log removed",
      });
    } catch (error) {
      console.error('Error deleting food log:', error);
      toast({
        title: "Error",
        description: "Failed to delete food log",
        variant: "destructive"
      });
    }
  };

  const getMealTypeIcon = (type?: string) => {
    switch(type) {
      case 'breakfast': return '🌅';
      case 'lunch': return '☀️';
      case 'dinner': return '🌙';
      case 'snack': return '🍿';
      default: return '🍽️';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (!logs || logs.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">No meals logged today</p>
          <p className="text-sm">Tap the camera button to add your first meal</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map(log => (
        <Card key={log.id} className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getMealTypeIcon(log.meal_type)}</span>
              <div>
                <p className="font-medium capitalize">
                  {log.meal_type || 'Meal'}
                </p>
                <p className="text-sm text-gray-600">
                  {formatTime(log.logged_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="font-bold text-lg">{log.total_calories} cal</p>
                {(log.total_protein || log.total_carbs || log.total_fat) && (
                  <p className="text-xs text-gray-600">
                    P:{log.total_protein || 0} C:{log.total_carbs || 0} F:{log.total_fat || 0}
                  </p>
                )}
              </div>
              <Button
                onClick={() => handleDelete(log.id)}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Food items */}
          {log.foods && log.foods.length > 0 && (
            <div className="space-y-1">
              {log.foods
                .filter((f: any) => f.included)
                .slice(0, 3)
                .map((food: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="text-gray-400">•</span>
                      {food.name} 
                      <span className="text-xs text-gray-400">
                        ({food.amount}{food.unit})
                      </span>
                    </span>
                    <span>{food.calories} cal</span>
                  </div>
                ))}
              {log.foods.filter((f: any) => f.included).length > 3 && (
                <p className="text-xs text-gray-400 italic">
                  +{log.foods.filter((f: any) => f.included).length - 3} more items
                </p>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}