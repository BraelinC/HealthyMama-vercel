import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export type ProfileSystemType = 'traditional' | 'smart';

export function useProfileSystem() {
  const [profileSystem, setProfileSystem] = useState<ProfileSystemType>('traditional');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectProfileSystem = async () => {
      try {
        // Check for weight-based profile data first (higher priority than localStorage)
        const token = localStorage.getItem('auth_token');
        let hasWeightBasedData = false;
        
        if (token) {
          try {
            const profileData = await apiRequest('/api/profile/weight-based');
            console.log('🔍 Checking profile type for auto-detection:', profileData);
            
            // Auto-detect smart profile if user has weight-based data
            if (profileData?.goalWeights && typeof profileData.goalWeights === 'object') {
              const hasValidWeights = Object.values(profileData.goalWeights).some(
                (weight: any) => typeof weight === 'number' && weight !== 0.5
              );
              
              if (hasValidWeights) {
                console.log('✅ Auto-detected weight-based profile, switching to smart system');
                hasWeightBasedData = true;
                setProfileSystem('smart');
                setIsLoading(false);
                return;
              }
            }
          } catch (error) {
            console.log('ℹ️ Could not fetch weight-based profile data, checking localStorage');
          }
        }

        // Only check localStorage if no weight-based data found
        if (!hasWeightBasedData) {
          const savedPreference = localStorage.getItem('profile-system-preference');
          if (savedPreference === 'smart' || savedPreference === 'traditional') {
            console.log('🔧 Using manual profile system preference:', savedPreference);
            setProfileSystem(savedPreference);
            setIsLoading(false);
            return;
          }
        }

        // Default to traditional system
        setProfileSystem('traditional');
        setIsLoading(false);
      } catch (error) {
        console.error('Error detecting profile system:', error);
        setProfileSystem('traditional');
        setIsLoading(false);
      }
    };

    detectProfileSystem();
  }, []);

  const toggleProfileSystem = (systemType: ProfileSystemType) => {
    setProfileSystem(systemType);
    localStorage.setItem('profile-system-preference', systemType);
  };

  const isSmartProfileEnabled = profileSystem === 'smart';

  return {
    profileSystem,
    isSmartProfileEnabled,
    isLoading,
    toggleProfileSystem,
    setToSmartProfile: () => toggleProfileSystem('smart'),
    setToTraditionalProfile: () => toggleProfileSystem('traditional')
  };
}