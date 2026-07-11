import React, { useState, useRef, useEffect } from 'react';
import { FirmDetails } from '../../types';
import { UploadIcon, TrashIcon } from '../../constants';
import { inputClassic } from '../../utils/formStyles';
import { formatNumberWithCommas, parseFormattedNumber } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';

interface FirmDetailsFormProps {
  firmDetails: FirmDetails;
  onUpdateFirmDetails: (details: FirmDetails) => void;
  onClose: () => void;
}

const FirmDetailsForm: React.FC<FirmDetailsFormProps> = ({ firmDetails, onUpdateFirmDetails, onClose }) => {
  const [name, setName] = useState(firmDetails.name);
  const [address, setAddress] = useState(firmDetails.address);
  const [logoUrl, setLogoUrl] = useState(firmDetails.logoUrl || '');
  const [letterheadUrl, setLetterheadUrl] = useState(firmDetails.letterheadUrl || '');
  const [revenueTarget, setRevenueTarget] = useState(firmDetails.monthlyRevenueTarget || 5000000);
  const [headerTextColor, setHeaderTextColor] = useState(firmDetails.headerTextColor || '#111827'); // Default dark slate
  const [vatRateInput, setVatRateInput] = useState(firmDetails.taxSettings?.vatRate ? (firmDetails.taxSettings.vatRate * 100).toString() : '7.5');
  const [defaultStateOfPractice, setDefaultStateOfPractice] = useState(firmDetails.defaultStateOfPractice || 'Lagos');

  // Hidden file inputs refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setter(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse VAT rate
    let newVatRate = parseFloat(vatRateInput) / 100;
    if (isNaN(newVatRate)) newVatRate = 0.075;

    onUpdateFirmDetails({ 
        ...firmDetails, 
        name, 
        address, 
        logoUrl, 
        letterheadUrl, 
        monthlyRevenueTarget: revenueTarget,
        headerTextColor,
        defaultStateOfPractice,
        taxSettings: {
            ...firmDetails.taxSettings,
            vatRate: newVatRate
        }
    });
    onClose();
  };

    const commonInputClass = inputClassic;
  
  const renderImageUpload = (
      label: string, 
      imageUrl: string, 
      setter: React.Dispatch<React.SetStateAction<string>>, 
      inputRef: React.RefObject<HTMLInputElement>,
      helperText?: string
  ) => (
      <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-800 hover:border-primary-400 dark:hover:border-primary-600 transition-all duration-300 group shadow-sm hover:shadow-sm cursor-default">
          <div className="flex justify-between items-start mb-3">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{label}</label>
          </div>
          
          <div className="flex items-start gap-4">
              <div className="w-24 h-24 flex-shrink-0 bg-gray-100 dark:bg-zinc-700 rounded-md border border-dashed border-gray-300 dark:border-zinc-600 flex items-center justify-center overflow-hidden relative group/image">
                  {imageUrl ? (
                      <>
                          <img src={imageUrl} alt={label} className="w-full h-full object-contain" />
                          <button 
                              type="button"
                              onClick={() => setter('')}
                              className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity text-white"
                          >
                              <TrashIcon className="w-6 h-6" />
                          </button>
                      </>
                  ) : (
                      <span className="text-xs text-gray-400 text-center px-1">No Image</span>
                  )}
              </div>
              <div className="flex-grow flex flex-col justify-between h-24">
                  <div className="flex-grow pr-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 transition-all duration-300 origin-left group-hover:scale-105 group-hover:text-gray-800 dark:group-hover:text-gray-200 leading-relaxed">
                          {helperText || "Recommended: PNG or JPG. Max 2MB."}
                      </p>
                  </div>
                  <div>
                    <input autoComplete="off" data-lpignore="true"  
                        type="file" 
                        ref={inputRef} 
                        className="hidden" 
                        accept="image/png, image/jpeg, image/jpg" 
                        onChange={(e) => handleFileUpload(e, setter)}
                    />
                    <button 
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="px-4 py-2 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-600 flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <UploadIcon className="w-4 h-4" />
                        {imageUrl ? 'Change Image' : 'Upload Image'}
                    </button>
                  </div>
              </div>
          </div>
      </div>
  );

  const PROFESSIONAL_COLORS = [
    { label: 'Slate Black', value: '#111827' },
    { label: 'Navy Blue', value: '#1e3a8a' },
    { label: 'Dark Green', value: '#064e3b' },
    { label: 'Maroon', value: '#7f1d1d' },
    { label: 'Deep Purple', value: '#581c87' },
    { label: 'Pure White', value: '#FFFFFF' },
    { label: 'Cream', value: '#FEF3C7' },
    { label: 'Light Gray', value: '#F3F4F6' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-3">
          <h4 className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 pb-2">Basic Information</h4>
          <div>
            <label htmlFor="firmName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Firm Name</label>
            <input autoComplete="off" data-lpignore="true"  type="text" id="firmName" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} required />
          </div>
          <div>
            <label htmlFor="firmAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Office Address</label>
            <textarea id="firmAddress" value={address} onChange={e => setAddress(e.target.value)} rows={3} className={commonInputClass} required />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                <label htmlFor="revenueTarget" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monthly Revenue Goal (<NairaSymbol/>)</label>
                <input autoComplete="off" data-lpignore="true"  
                    type="text" 
                    id="revenueTarget" 
                    value={formatNumberWithCommas(revenueTarget)} 
                    onChange={e => setRevenueTarget(parseFormattedNumber(e.target.value))} 
                    className={commonInputClass} 
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">For financial reporting targets.</p>
              </div>
              
               <div>
                <label htmlFor="vatRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">VAT Rate (%)</label>
                <input autoComplete="off" data-lpignore="true"  
                    type="number" 
                    id="vatRate" 
                    value={vatRateInput} 
                    onChange={e => setVatRateInput(e.target.value)} 
                    step="0.1"
                    min="0"
                    max="100"
                    className={commonInputClass} 
                />
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">Default tax rate applied to new invoices.</p>
              </div>

              {/* ─── Default State of Practice ─── */}
              <div>
                <label htmlFor="defaultStateOfPractice" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default State of Practice</label>
                <select
                    id="defaultStateOfPractice"
                    value={defaultStateOfPractice}
                    onChange={e => setDefaultStateOfPractice(e.target.value)}
                    className={commonInputClass}
                >
                    <option value="Lagos">Lagos State</option>
                    <option value="Delta">Delta State</option>
                    <option value="FCT">Federal Capital Territory (FCT)</option>
                    <option value="Rivers">Rivers State</option>
                    <option value="Abia">Abia State</option>
                    <option value="Anambra">Anambra State</option>
                    <option value="Enugu">Enugu State</option>
                    <option value="Imo">Imo State</option>
                    <option value="Oyo">Oyo State</option>
                    <option value="Kano">Kano State</option>
                    <option value="Kaduna">Kaduna State</option>
                    <option value="Edo">Edo State</option>
                    <option value="Ogun">Ogun State</option>
                    <option value="Ondo">Ondo State</option>
                    <option value="Cross River">Cross River State</option>
                    <option value="Akwa Ibom">Akwa Ibom State</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">All AI-generated drafts will default to this jurisdiction's court hierarchy and procedural rules unless explicitly specified otherwise.</p>
              </div>
          </div>

      </div>

      <div className="space-y-3">
          <h4 className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 pb-2">Branding Assets</h4>
          {renderImageUpload("Firm Logo", logoUrl, setLogoUrl, logoInputRef, "Upload a clear PNG or JPG of your logo. This will appear on invoices, emails, and the top navigation bar.")}
          {renderImageUpload("Letterhead Background", letterheadUrl, setLetterheadUrl, letterheadInputRef, "Upload a full A4 image (210x297mm). This acts as the background for all generated PDFs. The firm name and address will be overlaid on top.")}
      </div>

      <div className="pt-4 flex justify-end space-x-2 border-t border-gray-200 dark:border-zinc-700">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancel</button>
        <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">Save Changes</button>
      </div>
    </form>
  );
};
export default FirmDetailsForm;
