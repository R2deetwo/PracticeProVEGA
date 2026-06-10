import * as React from 'react';
import { useTipManager } from '../hooks/useTipManager';
import { useAuth } from './AuthContext';

const ONBOARDING_STORAGE_KEY = 'practicepro_tour_completed';

interface OnboardingContextType {
  isTourRunning: boolean;
  stepIndex: number;
  startTour: () => void;
  stopTour: (complete?: boolean) => void;
  resetTour: () => void;
  nextStep: () => void;
  backStep: () => void;
  goToStep: (index: number) => void;
  completeTour: () => void;
}

export const OnboardingContext = React.createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [isTourRunning, setIsTourRunning] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const { resetAllTips } = useTipManager();
  const { isAuthenticated } = useAuth();

  const startTour = React.useCallback(() => {
    resetAllTips(true); // Silently reset tips to ensure tour targets are visible
    setStepIndex(0);
    setIsTourRunning(true);
  }, [resetAllTips]);

  // REMOVED: The useEffect that auto-started the tour. 
  // Control is now fully handed over to App.tsx to ensure strict sequencing.

  const completeTour = React.useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch (error) {
      console.error("Could not save tour completion state:", error);
    }
  }, []);

  const stopTour = React.useCallback((complete = true) => {
    setIsTourRunning(false);
    if (complete) {
      completeTour();
    }
  }, [completeTour]);

  const resetTour = React.useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      startTour();
    } catch (error) {
      console.error("Could not reset tour state:", error);
    }
  }, [startTour]);

  const nextStep = React.useCallback(() => {
    setStepIndex(prev => prev + 1);
  }, []);

  const backStep = React.useCallback(() => {
    setStepIndex(prev => prev - 1);
  }, []);

  const goToStep = React.useCallback((index: number) => {
    setStepIndex(index);
  }, []);

  const value = React.useMemo(() => ({
    isTourRunning,
    stepIndex,
    startTour,
    stopTour,
    resetTour,
    nextStep,
    backStep,
    goToStep,
    completeTour
  }), [isTourRunning, stepIndex, startTour, stopTour, resetTour, nextStep, backStep, goToStep, completeTour]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = React.useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};