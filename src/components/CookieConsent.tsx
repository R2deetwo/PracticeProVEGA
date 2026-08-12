import React, { useState, useEffect } from 'react';
import { openLegalDocument } from '../utils/legalLinks';

const CookieConsent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('practicepro_cookie_consent');
        if (!consent) {
            // DELAY the cookie banner by 2.5 seconds so the app content
            // loads first. Previously the banner appeared immediately on
            // page load, making the app look broken (blank page with only
            // a cookie banner visible).
            const timer = setTimeout(() => setIsVisible(true), 2500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('practicepro_cookie_consent', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-slate-900/95 backdrop-blur-md border-t border-slate-700 text-white z-[9999] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl animate-slide-up">
            <div className="flex-1 text-xs text-slate-300 max-w-5xl mx-auto pl-4">
                We use cookies to enhance your experience and analyze usage in accordance with the NDPA 2023.{' '}
                <button onClick={() => openLegalDocument('privacy')} className="text-primary-400 hover:text-primary-300 underline font-medium">Privacy Policy</button>
            </div>
            <div className="flex gap-3 w-full sm:w-auto shrink-0 pr-4">
                <button
                    onClick={handleAccept}
                    className="flex-1 sm:flex-none px-5 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg"
                >
                    Acknowledge
                </button>
            </div>
        </div>
    );
};

export default CookieConsent;
