import React, { useState, useEffect } from 'react';
import { BankAccount } from '../../types';
import { CurrencyDollarIcon, InfoIcon, XIcon, SaveIcon, ShieldCheckIcon } from '../../constants';
import { Landmark as BankIcon, CreditCard as CreditCardIcon } from 'lucide-react';
import { inputClassic } from '../../utils/formStyles';

interface BankAccountFormProps {
  accountToEdit?: BankAccount;
  onAddAccount: (account: Omit<BankAccount, 'id' | 'isDefault'>) => void;
  onUpdateAccount: (account: BankAccount) => void;
  onSetDefault: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  onClose: () => void;
}

const BankAccountForm: React.FC<BankAccountFormProps> = ({ accountToEdit, onAddAccount, onUpdateAccount, onSetDefault, onDelete, onClose }) => {
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const isEditing = !!accountToEdit;

  useEffect(() => {
    if (isEditing && accountToEdit) {
      setAccountName(accountToEdit.accountName || '');
      setBankName(accountToEdit.bankName);
      setAccountNumber(accountToEdit.accountNumber);
    }
  }, [isEditing, accountToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !accountNumber.trim()) {
      alert("Bank Name and Account Number are required.");
      return;
    }
    const accountData = {
      accountName,
      bankName,
      accountNumber,
    };
    if (isEditing && accountToEdit) {
      onUpdateAccount({ ...accountToEdit, ...accountData });
    } else {
      onAddAccount(accountData);
    }
    onClose();
  };

    const commonInputClass = inputClassic;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="accountName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Name (Optional)</label>
        <input autoComplete="off" data-lpignore="true"  type="text" id="accountName" value={accountName} onChange={e => setAccountName(e.target.value)} className={commonInputClass} />
      </div>
      <div>
        <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bank Name</label>
        <input autoComplete="off" data-lpignore="true"  type="text" id="bankName" value={bankName} onChange={e => setBankName(e.target.value)} className={commonInputClass} required />
      </div>
      <div>
        <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Number</label>
        <input autoComplete="off" data-lpignore="true"  type="text" id="accountNumber" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className={commonInputClass} required pattern="\d{10}" title="Please enter a 10-digit account number"/>
      </div>
      {isEditing && !accountToEdit.isDefault && (
        <div>
          <button type="button" onClick={() => onSetDefault(accountToEdit.id)} className="w-full text-sm font-semibold text-primary-600 hover:underline">Set as Default Account</button>
        </div>
      )}
      <div className="pt-4 flex justify-between items-center">
        <div>{isEditing && <button type="button" onClick={() => onDelete(accountToEdit.id)} className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/80 transition-colors">Delete</button>}</div>
        <div className="space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">{isEditing ? 'Save Changes' : 'Add Account'}</button>
        </div>
      </div>
    </form>
  );
};
export default BankAccountForm;