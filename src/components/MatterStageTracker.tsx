import React, { useState, useEffect } from 'react';
import { MatterStage } from '../types';
import ScrollArrows from './ScrollArrows';

interface MatterStageTrackerProps {
  currentStage: MatterStage;
  stages: MatterStage[];
  onStageChange: (newStage: MatterStage) => void;
  fromStage?: string;
  toStage?: string;
  onAnimationComplete?: () => void;
  updatingStage?: string | null; // New prop for loading feedback
}

const MatterStageTracker: React.FC<MatterStageTrackerProps> = ({ currentStage, stages, onStageChange, fromStage, toStage, onAnimationComplete, updatingStage }) => {
  const [visualStageIndex, setVisualStageIndex] = useState(stages.indexOf(currentStage));

  useEffect(() => {
    const newIndex = stages.indexOf(currentStage);
    if (newIndex !== -1) {
      setVisualStageIndex(newIndex);
    }
  }, [currentStage, stages]);

  const LoadingSpinner = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  return (
    <div className="w-full p-2 py-4 overflow-visible">
      {/* 
         We specifically want the arrows to align with the CIRCLES (the track), not the whole height.
         The circles are 2rem (h-8). We use pt-1 on ScrollArrows to push it down slightly to match circle vertical center.
      */}
      <div className="relative group/tracker">
        <ScrollArrows className="items-start transition-all">
          <div className="flex items-start py-2 px-2 no-scrollbar">
            {stages.map((stage, index) => {
              const isCompleted = index < visualStageIndex;
              const isCurrent = index === visualStageIndex;
              const isLoading = updatingStage === stage;

              let colorClass = 'bg-gray-200 dark:bg-gray-700';
              if (isCompleted) colorClass = 'bg-green-500';
              if (isCurrent) colorClass = 'bg-primary-500 shadow-md ring-2 ring-primary-500/20 dark:ring-primary-400/10'; // Slimmed active ring
              if (isLoading) colorClass = 'bg-primary-600 ring-2 ring-primary-500/20'; // Loading state styling

              return (
                <React.Fragment key={stage}>
                  <div
                    className="flex flex-col items-center justify-start cursor-pointer flex-shrink-0 w-20 relative z-10 group/stage"
                    onClick={() => !isLoading && onStageChange(stage)}
                  >
                    {/* Circle Container - Fixed Height */}
                    <div className="h-8 flex items-center justify-center mb-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold transition-all duration-300 ${colorClass}`}>
                        {isLoading ? (
                          <LoadingSpinner />
                        ) : isCompleted ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>
                    </div>

                    {/* Label */}
                    <p title={stage} className={`text-[9px] font-bold transition-colors duration-300 w-full text-center px-1 leading-tight line-clamp-1 h-3 ${isCurrent || isCompleted || isLoading ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover/stage:text-gray-600 dark:group-hover/stage:text-gray-300'}`}>
                      {stage}
                    </p>
                  </div>

                  {/* Connector Line */}
                  {index < stages.length - 1 && (
                    <div className="flex-1 min-w-[1.5rem] h-[1px] mx-0 relative overflow-visible bg-gray-200 dark:bg-zinc-700 z-0 mt-[15px]">
                      {/* mt-15px aligns line exactly with center of h-8 container/w-7 circle */}
                      <div className={`absolute top-0 left-0 h-full bg-green-500 transition-all duration-500 ease-in-out`} style={{ width: isCompleted ? '100%' : '0%' }}></div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </ScrollArrows>
      </div>
    </div>
  );
};

export default MatterStageTracker;
