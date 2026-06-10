
import React from 'react';
import { DeviceMobileIcon } from '../constants';

const PortraitTourGuide: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-8 text-center text-white lg:hidden portrait:hidden">
            <div className="animate-pulse mb-6">
                <DeviceMobileIcon className="w-16 h-16 rotate-90" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Please Rotate Your Device</h2>
            <p className="text-slate-300 max-w-sm">
                PracticePro is optimized for portrait mode on mobile devices for the best task management experience.
            </p>
        </div>
    );
};

export default PortraitTourGuide;
