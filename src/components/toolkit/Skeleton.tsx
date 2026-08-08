
import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className, 
  width, 
  height, 
  variant = 'rectangular' 
}) => {
  const baseClasses = "animate-pulse bg-slate-200 dark:bg-zinc-700/50";
  const variantClasses = {
    text: "rounded-md",
    circular: "rounded-full",
    rectangular: "rounded-lg"
  };

  const style = {
    width: width,
    height: height,
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className || ''}`} 
      style={style}
    />
  );
};

export const DashboardSkeleton: React.FC = () => (
    <div className="space-y-8 animate-fade-in p-6">
        <div className="flex justify-between items-center pb-6 border-b border-slate-200 dark:border-zinc-700">
            <div className="space-y-2">
                <Skeleton width={200} height={32} />
                <Skeleton width={150} height={16} />
            </div>
             <Skeleton width={40} height={40} variant="circular" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
                 <div key={i} className="h-32 bg-white dark:bg-zinc-800 rounded-lg p-6 border border-slate-200 dark:border-zinc-700">
                    <Skeleton width={100} height={12} className="mb-4" />
                    <Skeleton width={60} height={36} />
                 </div>
            ))}
        </div>
    </div>
);

export const TasksSkeleton: React.FC = () => (
  <div className="flex flex-col h-full animate-fade-in p-6">
    <div className="flex justify-between items-center mb-6">
      <Skeleton width={150} height={36} />
      <Skeleton width={120} height={36} />
    </div>
    <div className="flex gap-4 pb-4 h-full overflow-hidden">
        {[1, 2, 3].map(i => (
             <div key={i} className="w-80 flex-shrink-0 flex flex-col space-y-4">
                 <Skeleton width="100%" height={200} />
                 <Skeleton width="100%" height={150} />
             </div>
        ))}
    </div>
  </div>
);

export const MattersSkeleton: React.FC = () => (
  <div className="flex flex-col h-full animate-fade-in p-6">
    <Skeleton width={200} height={40} className="mb-8" />
    <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} width="100%" height={64} />
        ))}
    </div>
  </div>
);

export const ContactsSkeleton: React.FC = () => (
  <div className="flex flex-col h-full animate-fade-in p-6">
      <Skeleton width={150} height={32} className="mb-6" />
      <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} width="100%" height={50} />
          ))}
      </div>
  </div>
);

export const DocumentsSkeleton: React.FC = () => (
     <div className="flex flex-col h-full bg-white dark:bg-zinc-900 animate-fade-in p-6">
        <div className="flex justify-between mb-6">
            <Skeleton width={150} height={32} />
            <Skeleton width={100} height={36} />
        </div>
        <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} height={120} />)}
        </div>
     </div>
);

export const GenericSkeleton: React.FC = () => (
    <div className="flex flex-col h-full animate-fade-in p-6">
        <Skeleton width={200} height={32} className="mb-6" />
        <div className="space-y-6">
            <Skeleton width="100%" height={200} />
            <Skeleton width="100%" height={100} />
        </div>
    </div>
);
