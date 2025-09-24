import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, User, Target, Save, Utensils, Goal, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  profileName: string;
  dietaryRestrictions: string[];
  goals: string[];
  familySize: number;
  culturalBackground: string[];
  profileType: 'individual';
}

interface UserProfileEditorProps {
  onSave: (profile: UserProfile) => void;
  initialProfile?: Partial<UserProfile>;
  isVisible: boolean;
  onClose: () => void;
}

const commonDietaryRestrictions = [
  'Milk',
  'Eggs',
  'Fish',
  'Shellfish',
  'Tree Nuts',
  'Peanuts',
  'Wheat',
  'Soy',
  'Sesame'
];

const additionalDietaryOptions = [
  'Vegetarian',
  'Vegan',
  'Keto',
  'Paleo',
  'Gluten-Free',
  'Dairy-Free',
  'Low Carb',
  'Low Sodium',
  'Sugar-Free',
  'No Seed Oils',
  'Kosher',
  'Halal',
  'FODMAP'
];

const personalGoals = [
  'Lose Weight',
  'Gain Muscle',
  'Improve Health',
  'Try New Foods',
  'Eat More Vegetables',
  'Reduce Sugar',
  'Increase Protein',
  'Build Healthy Habits',
  'Save Money',
  'Meal Prep',
  'Energy & Performance',
  'Digestive Health'
];

export default function UserProfileEditor({
  onSave,
  initialProfile,
  isVisible,
  onClose
}: UserProfileEditorProps) {
  const { toast } = useToast();
  const [profileName, setProfileName] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [customRestriction, setCustomRestriction] = useState('');
  const [customGoal, setCustomGoal] = useState('');

  // Load initial profile data
  useEffect(() => {
    if (initialProfile) {
      setProfileName(initialProfile.profileName || 'My Profile');
      setDietaryRestrictions(initialProfile.dietaryRestrictions || []);
      setGoals(initialProfile.goals || []);
    }
  }, [initialProfile]);

  const addDietaryRestriction = (restriction: string) => {
    if (!dietaryRestrictions.includes(restriction)) {
      setDietaryRestrictions([...dietaryRestrictions, restriction]);
    }
  };

  const removeDietaryRestriction = (restriction: string) => {
    setDietaryRestrictions(dietaryRestrictions.filter(r => r !== restriction));
  };

  const addCustomRestriction = () => {
    if (customRestriction.trim() && !dietaryRestrictions.includes(customRestriction.trim())) {
      setDietaryRestrictions([...dietaryRestrictions, customRestriction.trim()]);
      setCustomRestriction('');
    }
  };

  const addGoal = (goal: string) => {
    if (!goals.includes(goal)) {
      setGoals([...goals, goal]);
    }
  };

  const removeGoal = (goal: string) => {
    setGoals(goals.filter(g => g !== goal));
  };

  const addCustomGoal = () => {
    if (customGoal.trim() && !goals.includes(customGoal.trim())) {
      setGoals([...goals, customGoal.trim()]);
      setCustomGoal('');
    }
  };

  const handleSave = () => {
    if (!profileName.trim()) {
      toast({
        title: "Error",
        description: "Profile name is required.",
        variant: "destructive"
      });
      return;
    }

    const profile: UserProfile = {
      profileName: profileName.trim(),
      dietaryRestrictions,
      goals,
      familySize: 1,
      culturalBackground: [],
      profileType: 'individual'
    };

    onSave(profile);

    toast({
      title: "Success",
      description: "Your profile has been saved successfully!",
    });
  };

  if (!isVisible) return null;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Add Your Character Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Name */}
          <div>
            <Label htmlFor="profileName">Profile Name</Label>
            <Input
              id="profileName"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g., My Profile, John's Profile"
              className="mt-1"
            />
          </div>

          {/* Dietary Restrictions */}
          <div>
            <Label className="flex items-center gap-2">
              <span className="text-red-500">*</span>
              <Utensils className="h-4 w-4" />
              Dietary Restrictions
              <span className="text-xs text-gray-500">(100% compliance - these will be strictly followed)</span>
            </Label>

            {/* Common Allergies */}
            <div className="mt-2">
              <div className="text-sm font-medium text-gray-700 mb-2">Common Allergies:</div>
              <div className="flex flex-wrap gap-2">
                {commonDietaryRestrictions.map(restriction => (
                  <Button
                    key={restriction}
                    onClick={() => addDietaryRestriction(restriction)}
                    variant={dietaryRestrictions.includes(restriction) ? "destructive" : "outline"}
                    size="sm"
                    className="text-xs"
                  >
                    {restriction}
                  </Button>
                ))}
              </div>
            </div>

            {/* Diet Types */}
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Diet Types & Preferences:</div>
              <div className="flex flex-wrap gap-2">
                {additionalDietaryOptions.map(restriction => (
                  <Button
                    key={restriction}
                    onClick={() => addDietaryRestriction(restriction)}
                    variant={dietaryRestrictions.includes(restriction) ? "destructive" : "outline"}
                    size="sm"
                    className="text-xs"
                  >
                    {restriction}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Restriction Input */}
            <div className="mt-4">
              <div className="flex gap-2">
                <Input
                  value={customRestriction}
                  onChange={(e) => setCustomRestriction(e.target.value)}
                  placeholder="Add custom dietary restriction..."
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && addCustomRestriction()}
                />
                <Button onClick={addCustomRestriction} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Selected Restrictions Display */}
            {dietaryRestrictions.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-sm font-medium text-red-700 mb-2">
                  Your Dietary Restrictions ({dietaryRestrictions.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {dietaryRestrictions.map((restriction) => (
                    <Badge key={restriction} variant="destructive" className="flex items-center gap-1">
                      {restriction}
                      <button
                        onClick={() => removeDietaryRestriction(restriction)}
                        className="ml-1 text-white hover:text-gray-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Personal Goals */}
          <div>
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Personal Goals
              <span className="text-xs text-gray-500">(What you want to achieve)</span>
            </Label>

            <div className="mt-2">
              <div className="flex flex-wrap gap-2">
                {personalGoals.map(goal => (
                  <Button
                    key={goal}
                    onClick={() => addGoal(goal)}
                    variant={goals.includes(goal) ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                  >
                    {goal}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Goal Input */}
            <div className="mt-4">
              <div className="flex gap-2">
                <Input
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  placeholder="Add custom goal..."
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && addCustomGoal()}
                />
                <Button onClick={addCustomGoal} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Selected Goals Display */}
            {goals.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm font-medium text-blue-700 mb-2">
                  Your Goals ({goals.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {goals.map((goal) => (
                    <Badge key={goal} variant="secondary" className="flex items-center gap-1">
                      {goal}
                      <button
                        onClick={() => removeGoal(goal)}
                        className="ml-1 text-gray-600 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Profile
            </Button>
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}