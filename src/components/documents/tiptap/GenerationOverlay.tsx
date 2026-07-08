import React from 'react';

interface GenerationOverlayProps {
  label?: string;
}

const GenerationOverlay: React.FC<GenerationOverlayProps> = ({ label = 'Preparing your document...' }) => {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm pointer-events-auto">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-slate-200 dark:border-zinc-700 border-t-primary-500 rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{label}</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">This usually takes 10–20 seconds.</p>
        </div>
      </div>
    </div>
  );
};

export default GenerationOverlay;
