
import React from 'react';
import { useUI } from '../contexts/UIContext';
import Toast from './Toast';

const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useUI();

    return (
        <div 
            aria-live="assertive" 
            className="fixed inset-0 flex flex-col items-end justify-end px-4 py-6 pointer-events-none sm:p-6 sm:items-end z-[9999] space-y-3"
        >
            {/* We map in reverse order to stack newest at the bottom visually if flex-col-reverse, 
                but standard stacking (top to bottom) usually means newest on top or bottom depending on implementation.
                Here we simply render them. CSS handles the layout. */}
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onRemove={removeToast} />
            ))}
        </div>
    );
};

export default ToastContainer;
