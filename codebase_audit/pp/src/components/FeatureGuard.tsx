import React from 'react';
import { useProduct } from '../contexts/ProductContext';
import { Product as ProductType } from '../types';
import { useUI } from '../contexts/UIContext';
import { ShieldAlert } from 'lucide-react';

interface Props {
  requiredProduct: ProductType | ProductType[];
  children: React.ReactNode;
}

export const FeatureGuard: React.FC<Props> = ({ requiredProduct, children }) => {
  const { product } = useProduct();
  const { navigateTo } = useUI();

  const checkAllowed = (req: ProductType, current: ProductType) => {
    if (current === 'unified' || current === undefined) return true;
    if (req === 'property' && current === 'atrium') return true;
    if (req === 'atrium' && current === 'property') return true;
    if (req === 'legal' && current === 'vega') return true;
    if (req === 'vega' && current === 'legal') return true;
    return req === current;
  };

  const allowed = Array.isArray(requiredProduct)
    ? requiredProduct.some(req => checkAllowed(req as ProductType, product))
    : checkAllowed(requiredProduct as ProductType, product);

  if (!allowed) {
    const missingProductName = Array.isArray(requiredProduct) 
        ? requiredProduct.map(p => p === 'legal' ? 'Vega' : p === 'property' ? 'Atrium' : 'Unified').join(' or ')
        : (requiredProduct === 'legal' ? 'Vega' : requiredProduct === 'property' ? 'Atrium' : 'Unified');

    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-50 dark:bg-zinc-950 p-8 text-center animate-in fade-in duration-300">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-10 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-zinc-800 flex flex-col items-center">
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-6 ring-8 ring-rose-50/50 dark:ring-rose-900/10">
                <ShieldAlert className="w-10 h-10 text-rose-500 dark:text-rose-400" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Feature Not Available</h2>
            <p className="text-slate-500 dark:text-zinc-400 mb-8 leading-relaxed">
                This feature is part of <span className="font-bold text-slate-700 dark:text-zinc-300">{missingProductName}</span>. Your current workspace does not include this module.
            </p>
            <button 
                onClick={() => navigateTo('dashboard')}
                className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
            >
                Return to Dashboard
            </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
