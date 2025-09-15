import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { 
  Clock,
  ChefHat,
  Flame,
  Sparkles,
  Youtube,
  Workflow 
} from 'lucide-react';

interface DifficultyRaterProps {
  onDifficultySelected: (difficulty: number, useYouTube: boolean) => void;
  onCancel: () => void;
}

const DifficultyRater = ({ onDifficultySelected, onCancel }: DifficultyRaterProps) => {
  const [difficulty, setDifficulty] = useState<number>(3.0);
  
  const getDifficultyLabel = (value: number): string => {
    if (value <= 2) return "Beginner";
    if (value <= 3.5) return "Intermediate";
    return "Advanced";
  };

  const getDifficultyDescription = (value: number): string => {
    if (value === 1) return "Basic mixing, heating, assembly";
    if (value === 1.5) return "Simple prep with basic cooking";
    if (value === 2) return "Simple cooking methods, minimal timing";
    if (value === 2.5) return "Basic cooking with some technique";
    if (value === 3) return "Multiple steps, some technique required";
    if (value === 3.5) return "Complex preparations";
    if (value === 4) return "Complex techniques, precise timing";
    if (value === 4.5) return "Professional techniques";
    if (value === 5) return "Expert techniques, critical timing";
    return "Intermediate cooking";
  };
  
  const getDifficultyColor = (value: number): string => {
    if (value <= 2) return "text-green-500";
    if (value <= 3.5) return "text-amber-500";
    return "text-red-500";
  };
  
  const handleYouTubeSelection = () => {
    onDifficultySelected(difficulty, true);
  };
  
  const handleGrokSelection = () => {
    onDifficultySelected(difficulty, false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Recipe Difficulty</CardTitle>
        <CardDescription>
          Rate the difficulty level of the meal you want to make
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="text-center mb-2">
          <div className="text-2xl font-bold mb-1">
            <span className={getDifficultyColor(difficulty)}>
              {getDifficultyLabel(difficulty)} ({difficulty}/5)
            </span>
          </div>
          <p className="text-sm text-gray-600">{getDifficultyDescription(difficulty)}</p>
        </div>
        
        <div className="py-4">
          <Slider
            value={[difficulty]}
            min={1}
            max={5}
            step={0.5}
            onValueChange={([value]) => setDifficulty(value)}
          />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span className="font-medium text-green-500">1 - Beginner</span>
            <span className="font-medium text-amber-500">3 - Intermediate</span>
            <span className="font-medium text-red-500">5 - Expert</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className={`border rounded-lg p-4 text-center ${difficulty <= 3 ? 'border-primary' : 'border-gray-200'}`}>
            <Youtube className="h-8 w-8 mx-auto text-red-500 mb-2" />
            <h3 className="font-medium mb-1">YouTube Recipe</h3>
            <p className="text-xs text-gray-600">
              Find a matching video with ingredients and steps
            </p>
          </div>
          
          <div className={`border rounded-lg p-4 text-center ${difficulty > 3 ? 'border-primary' : 'border-gray-200'}`}>
            <Sparkles className="h-8 w-8 mx-auto text-purple-500 mb-2" />
            <h3 className="font-medium mb-1">AI Generation</h3>
            <p className="text-xs text-gray-600">
              Create a custom recipe with precise instructions
            </p>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-3">
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button
            variant="outline"
            className="w-full flex gap-2"
            onClick={handleYouTubeSelection}
          >
            <Youtube className="h-4 w-4" />
            {difficulty <= 3 ? "Recommended" : "Use YouTube"}
          </Button>
          
          <Button 
            className="w-full flex gap-2"
            onClick={handleGrokSelection}
          >
            <Workflow className="h-4 w-4" />
            {difficulty > 3 ? "Recommended" : "Use AI"}
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="w-full text-gray-500"
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DifficultyRater;