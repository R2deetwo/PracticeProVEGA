
import React, { useState } from 'react';
import { Property, PropertyCategory, PropertyStatus } from '../../types';
import { SaveIcon, XIcon, ShieldCheckIcon } from '../../constants';
// Modal import removed — ModalManager wraps this content in its own Modal.

interface BulkEditPropertyModalProps {
  propertyIds: string[];
  onConfirm: (data: { status?: PropertyStatus, category?: PropertyCategory }) => void;
  onClose: () => void;
}

export const BulkEditPropertyModal: React.FC<BulkEditPropertyModalProps> = ({ propertyIds, onConfirm, onClose }) => {
  const [status, setStatus] = useState<PropertyStatus | ''>('');
  const [category, setCategory] = useState<PropertyCategory | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    setIsSaving(true);
    const updateData: any = {};
    if (status) updateData.status = status;
    if (category) updateData.category = category;
    
    await onConfirm(updateData);
    setIsSaving(false);
    onClose();
  };

  return (
    <div>
      <div className="p-1 sm:p-4">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary-600 text-white rounded-2xl shadow-lg ring-4 ring-primary-500/10">
            <ShieldCheckIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Bulk Edit Properties</h3>
            <p className="text-sm text-slate-500 font-medium">Updating <span className="text-primary-600 dark:text-primary-300 font-bold">{propertyIds.length}</span> selected properties.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest ml-1">Update Status</label>
              <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value as PropertyStatus)}
                className="w-full bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-zinc-300 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all"
              >
                <option value="">Keep Original Status</option>
                <option value="Available">Available</option>
                <option value="Leased">Leased</option>
                <option value="For Sale">For Sale</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Under Renovation">Under Renovation</option>
              </select>
              <p className="text-3xs text-slate-400 italic px-1">This will override the current status of all selected properties.</p>
            </div>

            <div className="space-y-3">
              <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest ml-1">Update Category</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value as PropertyCategory)}
                className="w-full bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-zinc-300 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all"
              >
                <option value="">Keep Original Category</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Agricultural">Agricultural</option>
                <option value="Mixed-Use">Mixed-Use</option>
                <option value="Special-Purpose">Special-Purpose</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-100 dark:border-amber-900/50 flex items-start gap-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
              Warning: Bulk changes are permanent. Any specific details like lease data or valuations tied to the previous status may be hidden or reset based on the new status.
            </p>
          </div>

          <div className="flex flex-wrap-reverse sm:justify-end gap-3 pt-6 border-t border-slate-100 dark:border-zinc-800">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 sm:flex-none px-10 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-2xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
            >
              <XIcon className="w-4 h-4" /> Cancel
            </button>
            <button 
              type="button"
              disabled={isSaving || (!status && !category)}
              onClick={handleConfirm}
              className="flex-1 sm:flex-none px-12 py-3 bg-primary-600 text-white text-2xs font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:scale-100"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <><SaveIcon className="w-4 h-4" /> Apply Updates</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
