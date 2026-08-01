import React, { useState, useEffect } from 'react';
import { openLegalDocument } from '../utils/legalLinks';

const CookieConsent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('practicepro_cookie_consent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('practicepro_cookie_consent', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 text-white z-[9999] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl animate-slide-up">
            <div className="flex-1 text-sm text-slate-300 max-w-5xl mx-auto">
                <strong className="text-white text-base">We Value Your Privacy</strong><br />
                We use cookies and similar technologies to enhance your experience, analyze usage, and support our operations in accordance with the NDPA 2023. By continuing to use our platform, you agree to our <button onClick={() => openLegalDocument('privacy')} className="text-primary-400 hover:text-primary-300 underline font-medium">Privacy Policy</button>.
            </div>
            <div className="flex gap-3 w-full sm:w-auto shrink-0 pr-4">
                <button 
                    onClick={handleAccept} 
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-lg transition-colors shadow-lg"
                >
                    Acknowledge
                </button>
            </div>
        </div>
    );
};

export default CookieConsent;
