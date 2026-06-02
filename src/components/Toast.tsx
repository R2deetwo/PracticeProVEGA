
import React, { useEffect, useState } from 'react';
import { Toast as ToastType } from '../types';
import { CheckCircleIcon, InfoIcon, ShieldCheckIcon, TrashIcon } from '../constants';

const SuccessIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ErrorIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const InfoIconStyled = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

interface ToastProps {
  toast: ToastType;
  onRemove: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Defines the duration (ms) for the toast to stay on screen
  const DURATION = 5000;

  const handleAnimationEnd = () => {
    if (!isPaused && !isExiting) {
       setIsExiting(true);
       setTimeout(() => onRemove(toast.id), 300); // Wait for exit animation
    }
  };

  const handleManualClose = () => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
  };

  const handleLinkClick = () => {
    if (toast.link) {
      toast.link.onClick();
      handleManualClose();
    }
  };

  const config = {
    success: { icon: <SuccessIcon />, border: 'border-green-500', progress: 'bg-green-500' },
    error: { icon: <ErrorIcon />, border: 'border-red-500', progress: 'bg-red-500' },
    info: { icon: <InfoIconStyled />, border: 'border-blue-500', progress: 'bg-blue-500' },
    warning: { icon: <InfoIconStyled />, border: 'border-amber-500', progress: 'bg-amber-500' },
  };

  const style = config[toast.type];

  return (
    <div 
        className={`
            group relative w-full max-w-sm bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md 
            shadow-xl rounded-lg pointer-events-auto overflow-hidden border-l-4 ${style.border}
            transition-all duration-300 ease-in-out transform
            ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        `}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">{style.icon}</div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{toast.message}</div>
            {toast.link && (
              <p className="mt-1 text-sm">
                <button onClick={handleLinkClick} className="font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus:underline">
                  {toast.link.text}
                </button>
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={handleManualClose}
              className="bg-transparent rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gray-200 dark:bg-zinc-700">
          <div 
            className={`h-full ${style.progress}`}
            style={{ 
                width: '100%',
                animation: `shrink ${DURATION}ms linear forwards`,
                animationPlayState: isPaused ? 'paused' : 'running'
            }}
            onAnimationEnd={handleAnimationEnd}
          />
      </div>
    </div>
  );
};

export default Toast;
