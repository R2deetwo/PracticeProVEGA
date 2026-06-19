
import * as React from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import Tooltip from '../Tooltip';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { AloaIcon, LockClosedIcon, MicrophoneIcon } from '../../constants';
import { useFeatures } from '../../hooks/useFeatures';
import { getAssistantName } from '../../utils/assistantIdentity';

const AloaFAB: React.FC = () => {
    const { togglePanel, openPanel, isPanelOpen, isMinimized, aloaState } = useAloa();
    const { coreState, isDataLoaded } = useCoreState();
    const { view, modal, dockedModalType, isMobileSearchOpen, openModal } = useUI();
    const { isProperty } = useProduct();
    const { canUseAI } = useFeatures();
    const assistantName = getAssistantName(isProperty);

    const aiFeaturesEnabled = coreState.firmDetails.aiSettings?.enableAllAiFeatures ?? true;
    const isAiActive = canUseAI && aiFeaturesEnabled;

    // HIDE FAB IF ANY MODAL OR SEARCH IS OPEN
    if (modal || dockedModalType || isMobileSearchOpen) return null;

    // HIDE FAB IN RESEARCH OR MESSAGING (Fade transition)
    const isHidden = view === 'messaging' || view === 'research';

    const handleClick = () => {
        if (!isAiActive) {
            return;
        }
        
        const hasConsent = localStorage.getItem('practicepro_ai_consent') === 'true';
        if (!hasConsent) {
            openModal('aiConsent', null, { 
                onConsent: () => togglePanel() 
            });
            return;
        }

        if (isPanelOpen && isMinimized) {
            openPanel();
        } else {
            togglePanel();
        }
    };

    if (isPanelOpen && !isMinimized) return null;

    const isListening = aloaState === 'listening';
    const isSpeaking = aloaState === 'speaking';
    const isThinking = aloaState === 'thinking' || aloaState === 'connecting';

    let bgClass = isAiActive ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-700 hover:bg-slate-600';
    if (isListening) bgClass = 'bg-red-600 hover:bg-red-700 shadow-red-500/50';

    let animationClass = '';
    if (isListening) animationClass = 'animate-pulse ring-4 ring-red-400/50';
    else if (isSpeaking) animationClass = 'animate-bounce';
    else if (isThinking) animationClass = 'animate-pulse';

    // Apply visibility transition
    const visibilityClass = isHidden
        ? 'opacity-0 translate-y-10 pointer-events-none'
        : 'opacity-100 translate-y-0 pointer-events-auto';

    return (
        <div className={`fixed bottom-20 md:bottom-8 right-6 z-[1001] transition-all duration-500 ease-in-out ${visibilityClass}`}>
            <Tooltip text={isAiActive ? (isPanelOpen && isMinimized ? "Resume Chat" : `Open ${assistantName}®`) : `Unlock ${assistantName}® AI`}>
                <button
                    onClick={handleClick}
                    data-tour-id="aloa-fab"
                    className={`
                        relative w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center 
                        transition-all transform hover:scale-105 active:scale-95 focus:outline-none 
                        focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-zinc-900 focus:ring-primary-500 group
                        ${bgClass}
                        ${animationClass}
                    `}
                    aria-label={`Open AI Assistant ${assistantName}`}
                >
                    {isAiActive && !isListening && (
                        <span
                            className="absolute inset-0 rounded-full bg-green-500 opacity-75 group-hover:animate-ping group-active:animate-ping"
                            style={{ animationDuration: '2.5s' }}
                        ></span>
                    )}

                    <div className="relative z-10">
                        {isListening ? (
                            <MicrophoneIcon className="w-7 h-7" />
                        ) : (
                            <AloaIcon className="w-8 h-8" />
                        )}
                    </div>

                    {!isAiActive && (
                        <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1 shadow-sm border border-white z-20">
                            <LockClosedIcon className="w-3 h-3" />
                        </div>
                    )}
                </button>
            </Tooltip>
        </div>
    );
};

export default AloaFAB;
