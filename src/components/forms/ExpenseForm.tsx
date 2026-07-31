import React, { useState, useEffect } from 'react';
import { Expense, Matter } from '../../types';
import { formatNumberWithCommas, parseFormattedNumber, formatNaira } from '../../utils/formatting';
import { analyzeExpenseDeductibility } from '../../agents/NigerianTaxComplianceAgent';
import { ZapIcon, CalendarIcon, SaveIcon, XIcon, OfficeBuildingIcon, ShieldCheckIcon, InfoIcon } from '../../constants';
import { Receipt } from 'lucide-react';
import { inputModern } from '../../utils/formStyles';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import NairaSymbol from '../NairaSymbol';

interface ExpenseFormProps {
  matter: Matter;
  expenseToEdit?: Expense;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateExpense: (expense: Expense) => void;
  onClose: () => void;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ matter, expenseToEdit, onAddExpense, onUpdateExpense, onClose }) => {
  const { addToast } = useUI();
  const { hasPropertyFeatures } = useProduct();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [taxAnalysis, setTaxAnalysis] = useState<{ isDeductible: boolean; reason: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const isEditing = !!expenseToEdit;

  useEffect(() => {
    if (isEditing && expenseToEdit) {
      setDate(expenseToEdit.date);
      setAmount(expenseToEdit.amount);
      setDescription(expenseToEdit.description);
      setIsBillable(expenseToEdit.isBillable);
      if (expenseToEdit.taxDeductibility) {
        setTaxAnalysis(expenseToEdit.taxDeductibility);
      }
    }
  }, [isEditing, expenseToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!description.trim() || amount <= 0) {
      addToast("Please provide a valid description and amount.", { type: 'info' });
      return;
    }
    /* Added firmId to satisfy Omit<Expense, "id"> interface */
    const expenseData: Omit<Expense, 'id'> = {
      firmId: matter.firmId,
      matterId: matter.id,
      date,
      amount,
      description,
      isBillable,
      billedInInvoiceId: null,
      taxDeductibility: taxAnalysis ? { isDeductible: taxAnalysis.isDeductible, reason: taxAnalysis.reason } : undefined
    };
    setIsSubmitting(true);
    try {
      if (isEditing && expenseToEdit) {
        await onUpdateExpense({ ...expenseToEdit, ...expenseData });
      } else {
        await onAddExpense(expenseData);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnalyzeTax = async () => {
    if (!description.trim()) return;
    setIsAnalyzing(true);
    const result = await analyzeExpenseDeductibility({ description } as Expense);
    setTaxAnalysis(result);
    setIsAnalyzing(false);
  };

    const commonInputClass = inputModern;
    const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 -m-2">
            <div className="space-y-2 sm:space-y-3 pb-6">
                {/* Financial Disbursement Section */}
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-3">
                    <div className="flex items-center gap-4 mb-2 px-1">
                        <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm ring-2 ring-emerald-500/10">
                            <Receipt className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <p className="text-2xs font-bold text-emerald-600 dark:text-emerald-400/70 uppercase tracking-widest leading-none mb-0.5">Details</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Matter Association</h3>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label className={labelClass}>{hasPropertyFeatures ? 'Property' : 'Case'} Association</label>
                        <div className="relative">
                            <OfficeBuildingIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <div className={`${commonInputClass} pl-11 bg-slate-50 dark:bg-zinc-900/50 flex items-center`}>
                                {matter.title}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label htmlFor="description" className={labelClass}>Description</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} className={`${commonInputClass} resize-none`} placeholder="What was this expense for?" required />
                    </div>
                </div>

                {/* Allocation Parameters */}
                <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-800/30 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm space-y-3">
                    <div className="flex items-center gap-4 px-1">
                        <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm ring-2 ring-primary-500/10">
                            <CalendarIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <p className="text-2xs font-bold text-primary-600 dark:text-primary-300/70 uppercase tracking-widest leading-none mb-0.5">Finance</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Amount & Date</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-2 group">
                            <label htmlFor="date" className={labelClass}>Date</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input autoComplete="off" data-lpignore="true"  type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className={`${commonInputClass} pl-11`} required />
                            </div>
                        </div>
                        <div className="space-y-2 group">
                            <label htmlFor="amount" className={labelClass}>Transaction Amount (₦)</label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400"><NairaSymbol /></div>
                                <input autoComplete="off" data-lpignore="true"  type="text" id="amount" value={formatNumberWithCommas(amount)} onChange={e => setAmount(parseFormattedNumber(e.target.value))} className={`${commonInputClass} pl-10`} required />
                            </div>
                        </div>
                    </div>                    <div className="flex flex-wrap justify-between items-center gap-4 p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm transition-all group">
                         <label htmlFor="isBillable" className="flex items-center gap-4 cursor-pointer">
                            <div className={`p-1.5 rounded-lg transition-colors ${isBillable ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-900/30' : 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600'}`}>
                                <Receipt className="w-3.5 h-3.5" />
                            </div>
                            <div>
                                <p className="text-2xs font-black text-slate-700 dark:text-zinc-300 uppercase tracking-widest leading-none mb-1">Billable Expense</p>
                                <p className="text-3xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tighter">Include in Next Invoice</p>
                            </div>
                            <input autoComplete="off" data-lpignore="true"  type="checkbox" id="isBillable" checked={isBillable} onChange={e => setIsBillable(e.target.checked)} className="hidden" />
                        </label>

                        {!taxAnalysis && (
                            <button type="button" onClick={handleAnalyzeTax} disabled={isAnalyzing} className="px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-3xs font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-2">
                                <ZapIcon className="w-3.5 h-3.5" />
                                {isAnalyzing ? 'Analyzing...' : 'Check Tax Status'}
                            </button>
                        )}
                    </div>
                    
                    {taxAnalysis && (
                        <div className={`p-3 sm:p-4 rounded-xl border transition-all animate-in slide-in-from-top-2 duration-500 ${taxAnalysis.isDeductible ? 'bg-emerald-50 dark:bg-emerald-950/40/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-rose-50/50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30'}`}>
                            <div className="flex gap-4">
                                <div className={`p-2 rounded-xl h-fit ${taxAnalysis.isDeductible ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-900/20' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/20'}`}>
                                    {taxAnalysis.isDeductible ? <ShieldCheckIcon className="w-5 h-5" /> : <InfoIcon className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className={`text-xs font-black uppercase tracking-widest mb-1 ${taxAnalysis.isDeductible ? 'text-emerald-700 dark:text-emerald-300 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                        {taxAnalysis.isDeductible ? 'Likely Deductible Asset' : 'Likely Non-Deductible Outlay'}
                                    </p>
                                    <p className="text-sm text-slate-700 dark:text-zinc-300 font-medium leading-relaxed">{taxAnalysis.reason}</p>
                                    <button type="button" onClick={() => setTaxAnalysis(null)} className="mt-4 text-3xs font-black uppercase tracking-widest text-slate-400 hover:text-primary-600 transition-colors">Re-evaluate Logic</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="sticky bottom-0 left-0 right-0 pt-4 sm:pt-8 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-20 pb-safe-extra">
                <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                    <XIcon className="w-4 h-4" /> Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 sm:px-12 py-2.5 bg-primary-600 text-white text-xs font-semibold rounded-xl sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <SaveIcon className="w-4 h-4" /> {isEditing ? 'Save Changes' : 'Create Expense'}
                </button>
            </div>
        </form>
    );
};

export default ExpenseForm;
