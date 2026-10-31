import React from 'react';
import { useProduct } from '../../contexts/ProductContext';

interface AIConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

const AIConsentModal: React.FC<AIConsentModalProps> = ({ onAccept, onDecline }) => {
  const { isProperty } = useProduct();
  // R47: the product speaks its own name (owner: "we need to be removing
  // this Practice Pro from the Atrium product unless it's where it's
  // necessary") — PracticePro appears only as the builder's credit at
  // the bottom. The assistant names are per-product (ALOA for Vega,
  // ARIA for Atrium — the old copy's "ALDIA" was a typo).
  const productName = isProperty ? 'Atrium' : 'Vega';
  const productLabel = isProperty ? 'Property OS' : 'Legal OS';
  const assistant = isProperty ? 'ARIA' : 'ALOA';

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">AI Processing Consent</h2>
        <p className="text-xs text-slate-500">{productName} — {productLabel}</p>
      </div>
      
      <div className="text-sm text-slate-600 dark:text-zinc-400 space-y-3">
        <p>
          {productName} uses its specialised AI assistant ({assistant}) to assist with {isProperty ? 'property management, tenant screening, and document processing' : 'legal drafting, research, and data extraction'}.
        </p>
        <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-lg border border-slate-200 dark:border-zinc-700 text-left">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Data Minimization:</strong> Only relevant data is processed by the AI.</li>
            <li><strong>No Model Training:</strong> Your private data is <strong>never</strong> used to train foundational AI models.</li>
            <li><strong>Security:</strong> All inputs remain isolated within your firm's encrypted workspace.</li>
            <li><strong>Oversight:</strong> The AI acts as a tool; human review is always required.</li>
          </ul>
        </div>
        <p className="font-medium text-slate-700 dark:text-zinc-300">
          Do you consent to the processing of your queries and documents by our AI agents in accordance with our Terms of Service?
        </p>
      </div>
      
      <div className="flex gap-3">
        <button
          onClick={onDecline}
          className="flex-1 py-3 px-4 border border-slate-300 dark:border-zinc-700 rounded-lg font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 transition-colors"
        >
          Decline
        </button>
        <button
          onClick={onAccept}
          className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-md transition-colors"
        >
          I Consent
        </button>
      </div>

      <p className="text-center text-2xs text-slate-400">
        {productName} is built by PracticePro
      </p>
    </div>
  );
};

export default AIConsentModal;
