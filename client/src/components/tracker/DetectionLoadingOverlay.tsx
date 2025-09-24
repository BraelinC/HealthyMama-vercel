import { useEffect, useState } from 'react';
import { Loader2, Cpu, Zap, Check } from 'lucide-react';

interface DetectionLoadingOverlayProps {
  imageUrl: string;
  onComplete?: () => void;
}

export default function DetectionLoadingOverlay({ imageUrl, onComplete }: DetectionLoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Connecting to LogMeal AI...');
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { icon: Cpu, text: 'Uploading to LogMeal...', duration: 800 },
    { icon: Zap, text: 'Analyzing dishes & ingredients...', duration: 1200 },
    { icon: Check, text: 'Detecting complex meals...', duration: 1000 }
  ];

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    let stepTimeout: NodeJS.Timeout;

    // Simulate progress
    progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          if (onComplete) {
            setTimeout(onComplete, 300);
          }
          return 100;
        }
        return prev + 2;
      });
    }, 60);

    // Update steps
    const updateStep = (index: number) => {
      if (index >= steps.length) return;
      
      setCurrentStep(index);
      setStatusText(steps[index].text);
      
      stepTimeout = setTimeout(() => {
        updateStep(index + 1);
      }, steps[index].duration);
    };

    updateStep(0);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stepTimeout);
    };
  }, [onComplete]);

  const CurrentIcon = currentStep < steps.length ? steps[currentStep].icon : Check;

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center">
      {/* Background image (blurred) */}
      <div 
        className="absolute inset-0 opacity-20 blur-xl"
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* LogMeal AI Badge */}
        <div className="mb-8 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 rounded-full">
          <span className="text-white font-bold text-sm">LogMeal Food AI</span>
        </div>

        {/* Main animation container */}
        <div className="relative w-32 h-32 mb-8">
          {/* Rotating ring */}
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center shadow-2xl">
              <CurrentIcon className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Scanning lines */}
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-scan" />
          </div>
        </div>

        {/* Status text */}
        <p className="text-white text-lg mb-2 animate-pulse">{statusText}</p>
        
        {/* Progress bar */}
        <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Progress percentage */}
        <p className="text-gray-400 text-sm">{Math.round(progress)}% Complete</p>

        {/* Step indicators */}
        <div className="flex gap-2 mt-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index <= currentStep 
                  ? 'bg-purple-500 w-8' 
                  : 'bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Technical info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">Advanced Food Recognition AI</p>
          <p className="text-xs text-gray-500">1300+ Dishes • Ingredient Extraction • Portion Estimation</p>
        </div>
      </div>

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple-400 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`
            }}
          />
        ))}
      </div>
    </div>
  );
}