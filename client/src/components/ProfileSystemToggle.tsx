import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Info, Settings, Target, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProfileSystemToggleProps {
  isSmartProfileEnabled: boolean;
  onToggleChange: (enabled: boolean) => void;
}

export default function ProfileSystemToggle({ isSmartProfileEnabled, onToggleChange }: ProfileSystemToggleProps) {
  const { toast } = useToast();

  const handleToggleChange = (enabled: boolean) => {
    // Save preference to localStorage for persistence
    localStorage.setItem('profile-system-preference', enabled ? 'smart' : 'traditional');
    
    onToggleChange(enabled);
    
    toast({
      title: `Switched to ${enabled ? 'Smart' : 'Traditional'} Profile`,
      description: enabled 
        ? "Using weight-based intelligent meal planning"
        : "Using traditional family-based meal planning"
    });
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-purple-600" />
          Profile System Settings
          <Badge variant="outline" className="ml-auto">
            {isSmartProfileEnabled ? 'Smart Mode' : 'Traditional Mode'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="profile-system-toggle" className="text-base font-medium">
              Enable Smart Profile System
            </Label>
            <p className="text-sm text-gray-600">
              Switch between traditional family profiles and intelligent weight-based planning
            </p>
          </div>
          <Switch
            id="profile-system-toggle"
            checked={isSmartProfileEnabled}
            onCheckedChange={handleToggleChange}
            className="data-[state=checked]:bg-purple-600"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Traditional System Info */}
          <div className={`p-4 rounded-lg border-2 transition-all ${
            !isSmartProfileEnabled 
              ? 'border-emerald-300 bg-emerald-50' 
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">Traditional System</span>
              {!isSmartProfileEnabled && <Badge variant="secondary" className="text-xs">Active</Badge>}
            </div>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Family member management</li>
              <li>• Individual dietary preferences</li>
              <li>• Goal-based meal planning</li>
              <li>• Cultural cuisine integration</li>
            </ul>
          </div>

          {/* Smart System Info */}
          <div className={`p-4 rounded-lg border-2 transition-all ${
            isSmartProfileEnabled 
              ? 'border-purple-300 bg-purple-50' 
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Smart System</span>
              {isSmartProfileEnabled && <Badge variant="secondary" className="text-xs">Active</Badge>}
            </div>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Weight-based priority system</li>
              <li>• Intelligent conflict resolution</li>
              <li>• Cost/health/time optimization</li>
              <li>• Advanced cultural integration</li>
            </ul>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <strong>Testing Mode:</strong> Both systems are available for comparison. 
            Your existing profile data is preserved when switching between systems.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}