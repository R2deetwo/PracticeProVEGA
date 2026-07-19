import React, { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { SparklesIcon, ClipboardIcon } from 'lucide-react';

interface SmartPasteBoxProps {
    onExtract: (data: { name?: string; email?: string; phone?: string; address?: string }) => void;
}

const SmartPasteBox: React.FC<SmartPasteBoxProps> = ({ onExtract }) => {
    const [pastedText, setPastedText] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const { addToast } = useUI();
    const extractAction = useAction(api.ai.extractContactInfo);

    const handleExtract = async () => {
        if (!pastedText.trim()) return;
        setIsExtracting(true);
        try {
            const result = await extractAction({ text: pastedText });
            if (result) {
                onExtract(result);
                setPastedText('');
                addToast("Contact information extracted successfully.", { type: 'success' });
            }
        } catch (error) {
            console.error('Extraction failed:', error);
            addToast("Failed to extract contact information. Please check the text format.", { type: 'error' });
        } finally {
            setIsExtracting(false);
        }
    };

    return (
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-zinc-800">
            <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest hover:text-primary-600 transition-colors list-none">
                    <ClipboardIcon className="w-3.5 h-3.5" />
                    <span>Or Paste Contact Details</span>
                </summary>
                <div className="mt-4 space-y-3">
                    <p className="text-2xs text-slate-400 dark:text-zinc-500">Paste an email signature or business card text here to auto-fill fields.</p>
                    <textarea
                        placeholder="Paste text containing name, email, phone, address..."
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        rows={4}
                        className="w-full p-4 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                    />
                    <button
                        type="button"
                        onClick={handleExtract}
                        disabled={isExtracting || !pastedText.trim()}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white text-2xs font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
                    >
                        <SparklesIcon className="w-3.5 h-3.5" />
                        {isExtracting ? 'Extracting...' : 'Extract Info'}
                    </button>
                </div>
            </details>
        </div>
    );
};

export default SmartPasteBox;
