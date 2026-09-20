import React, { useState, useEffect } from 'react';
import { BankAccount } from '../../types';
import { Button, Input } from '../ui';
import { useUI } from '../../contexts/UIContext';
import { validateBankAccountInput } from '../../utils/bankAccountValidation';

interface BankAccountFormProps {
  accountToEdit?: BankAccount;
  onAddAccount: (account: Omit<BankAccount, 'id' | 'isDefault'>) => void;
  onUpdateAccount: (account: BankAccount) => void;
  onSetDefault: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  onClose: () => void;
}

/**
 * PILOT ADOPTION of the shared ui/ primitives (ADR-0004, Chunk A).
 *
 * What changed vs. the hand-rolled version (all flagged, nothing silent):
 * - <Input> wires label -> htmlFor -> aria-describedby automatically and
 *   renders the same inputClassic variant this form already used.
 * - The submit button matched the dominant measured pattern verbatim
 *   ("px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold
 *   hover:bg-primary-700 transition-colors shadow-sm") — zero visual
 *   change; a focus-visible ring appears only on keyboard focus.
 * - Cancel normalized to the standard secondary (was bg-slate-200 with a
 *   duplicated dark:hover class — the 1-shade drift this layer retires).
 * - Delete maps to the new danger-soft variant (7x exact pattern
 *   elsewhere in the codebase; was the same string verbatim).
 * - Field labels normalize dark:text-dim-300 -> dark:text-zinc-300 (the
 *   codebase-standard label color; this file was the drifted one).
 */
const BankAccountForm: React.FC<BankAccountFormProps> = ({ accountToEdit, onAddAccount, onUpdateAccount, onSetDefault, onDelete, onClose }) => {
  const { addToast } = useUI();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TASK 64: the user's standard — every bank account record carries an
    // ACCOUNT NAME, BANK and ACCOUNT NUMBER (shared validation util keeps
    // this consistent with the backend manageBankAccount gate).
    const validation = validateBankAccountInput({ accountName, bankName, accountNumber });
    if (!validation.ok) {
      addToast(validation.error, { type: 'error' });
      return;
    }
    const accountData = validation.value;
    if (isEditing && accountToEdit) {
      await onUpdateAccount({ ...accountToEdit, ...accountData });
    } else {
      await onAddAccount(accountData);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label="Account Name"
        id="accountName"
        styleVariant="classic"
        autoComplete="off"
        data-lpignore="true"
        type="text"
        value={accountName}
        onChange={e => setAccountName(e.target.value)}
        placeholder="e.g. Firm Operating Account"
        required
      />
      <Input
        label="Bank Name"
        id="bankName"
        styleVariant="classic"
        autoComplete="off"
        data-lpignore="true"
        type="text"
        value={bankName}
        onChange={e => setBankName(e.target.value)}
        placeholder="e.g. Guaranty Trust Bank"
        required
      />
      <Input
        label="Account Number"
        id="accountNumber"
        styleVariant="classic"
        autoComplete="off"
        data-lpignore="true"
        type="text"
        value={accountNumber}
        onChange={e => setAccountNumber(e.target.value)}
        required
        pattern="\d{10}"
        title="Please enter a 10-digit account number"
      />
      {isEditing && !accountToEdit.isDefault && (
        <div>
          <button type="button" onClick={() => onSetDefault(accountToEdit.id)} className="w-full text-sm font-semibold text-primary-600 dark:text-primary-300 hover:underline">Set as Default Account</button>
        </div>
      )}
      <div className="pt-4 flex justify-between items-center">
        <div>{isEditing && <Button variant="danger-soft" onClick={() => onDelete(accountToEdit.id)}>Delete</Button>}</div>
        <div className="space-x-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit">{isEditing ? 'Save Changes' : 'Add Account'}</Button>
        </div>
      </div>
    </form>
  );
};
export default BankAccountForm;
