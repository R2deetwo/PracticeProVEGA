import * as React from 'react';
import { useTipManager } from '../hooks/useTipManager';
import { useAuth } from './AuthContext';
import { useDataActions } from './DataContext';

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
  const { isAuthenticated, currentUser } = useAuth();
  const { handleUpdateUser } = useDataActions();

  const startTour = React.useCallback(() => {
    resetAllTips(true);
    setStepIndex(0);
    setIsTourRunning(true);
  }, [resetAllTips]);

  // PERSISTENCE: Tour completion is written to BOTH localStorage (fast
  // UI gating) AND the database (user.onboardingCompleted = true).
  // The database flag is the source of truth — it survives device
  // switches, APK reinstalls, and cache clears. The localStorage flag
  // is only for fast initial render before the user query resolves.
  const completeTour = React.useCallback(() => {
    // 1. localStorage — fast UI gating
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch (error) {
      console.error("Could not save tour completion state:", error);
    }
    // 2. Database — durable persistence (survives device switches)
    if (currentUser?.id) {
      try {
        handleUpdateUser(currentUser.id, { onboardingCompleted: true });
      } catch (error) {
        console.warn('[OnboardingProvider] Failed to persist tour completion to database:', error);
      }
    }
  }, [currentUser?.id, handleUpdateUser]);

  const stopTour = React.useCallback((complete = true) => {
    setIsTourRunning(false);
    if (complete) {
      completeTour();
    }
  }, [completeTour]);

  const resetTour = React.useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      // Also reset the database flag so the tour can re-run
      if (currentUser?.id) {
        try {
          handleUpdateUser(currentUser.id, { onboardingCompleted: false });
        } catch {}
      }
    } catch (error) {
      console.error("Could not reset tour state:", error);
    }
    startTour();
  }, [startTour, currentUser?.id, handleUpdateUser]);

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