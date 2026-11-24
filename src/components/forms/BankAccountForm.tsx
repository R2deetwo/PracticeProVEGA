import React, { useState, useEffect } from 'react';
import { BankAccount, BankAccountPurpose } from '../../types';
import { Button, Input, Select } from '../ui';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { useCoreState } from '../../contexts/CoreContext';
import { validateBankAccountInput } from '../../utils/bankAccountValidation';

interface BankAccountFormProps {
  accountToEdit?: BankAccount;
  onAddAccount: (account: Omit<BankAccount, 'id' | 'isDefault'>) => void;
  onUpdateAccount: (account: BankAccount) => void;
  onSetDefault: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  onClose: () => void;
}

/** OWNER BRIEF 2026-11-25 (Financial Configuration):
 *  - 5-account cap — mirrors the server gate in convex manageBankAccount so
 *    the checklist deep-link path can't exceed it either.
 *  - Komplete fund segregation — on the Komplete plan each account can be
 *    designated by purpose (Law Firm / Estate / Unified); Vega-only and
 *    Atrium-only firms never see the picker. */
const MAX_BANK_ACCOUNTS = 5;

const PURPOSE_OPTIONS: { value: BankAccountPurpose; label: string; hint: string }[] = [
  { value: 'law_firm', label: 'Law Firm Account', hint: 'Legal practice funds' },
  { value: 'estate_property', label: 'Estate / Property Account', hint: 'Real-estate client funds' },
  { value: 'unified', label: 'Unified / Combined Account', hint: 'Law & estate combined' },
];

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
  const { isUnified } = useProduct();
  const { coreState } = useCoreState();
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  // Komplete purpose designation (owner brief 2026-11-25).
  const [purpose, setPurpose] = useState<BankAccountPurpose | ''>('');
  // UX-04 (double-submit guard): a fast second click re-fired the bank
  // account write — the button disables itself for the save.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!accountToEdit;
  const existingAccounts: BankAccount[] = coreState.firmDetails?.bankAccounts || [];
  // The cap only gates NEW accounts (the form in add mode); editing an
  // existing one never counts extra.
  const capReached = !isEditing && existingAccounts.length >= MAX_BANK_ACCOUNTS;

  useEffect(() => {
    if (isEditing && accountToEdit) {
      setAccountName(accountToEdit.accountName || '');
      setBankName(accountToEdit.bankName);
      setAccountNumber(accountToEdit.accountNumber);
      setPurpose(accountToEdit.purpose || '');
    }
  }, [isEditing, accountToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    // 5-account cap (client mirror of the server gate) — the honest message
    // instead of a server round-trip rejection.
    if (capReached) {
      addToast(`You've reached the ${MAX_BANK_ACCOUNTS}-account limit. Contact our team if your practice needs more accounts.`, { type: 'info', duration: 8000 });
      return;
    }
    // TASK 64: the user's standard — every bank account record carries an
    // ACCOUNT NAME, BANK and ACCOUNT NUMBER (shared validation util keeps
    // this consistent with the backend manageBankAccount gate).
    const validation = validateBankAccountInput({ accountName, bankName, accountNumber });
    if (!validation.ok) {
      addToast(validation.error, { type: 'error' });
      return;
    }
    const accountData = validation.value as any;
    setIsSubmitting(true);
    try {
      if (isEditing && accountToEdit) {
        // On Komplete the purpose key is ALWAYS present when editing (a
        // cleared picker sends undefined — the server clears the stored
        // designation); on Vega/Atrium-only the key is absent so their
        // accounts stay untouched.
        await onUpdateAccount({ ...accountToEdit, ...accountData, ...(isUnified ? { purpose: (purpose || undefined) as BankAccountPurpose | undefined } : {}) });
      } else {
        await onAddAccount({ ...accountData, ...(isUnified && purpose ? { purpose } : {}) });
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (capReached) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">Bank account limit reached</p>
        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
          Your workspace already has {MAX_BANK_ACCOUNTS} bank accounts — the maximum. If your practice genuinely needs more,
          contact the PracticePro team and we'll set it up for you.
        </p>
        <div className="pt-2 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

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
      {/* Komplete purpose designation (owner brief 2026-11-25) — visible
          ONLY on the Komplete plan, where fund segregation between the law
          practice and the property business is the point. */}
      {isUnified && (
        <Select
          label="Account Purpose"
          id="accountPurpose"
          styleVariant="classic"
          value={purpose}
          onChange={e => setPurpose(e.target.value as BankAccountPurpose | '')}
          hint="Designate this account's purpose to keep legal and estate client funds segregated."
        >
          <option value="">Not designated</option>
          {PURPOSE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>
          ))}
        </Select>
      )}
      {isEditing && !accountToEdit.isDefault && (
        <div>
          <button type="button" onClick={() => onSetDefault(accountToEdit.id)} className="w-full text-sm font-semibold text-primary-600 dark:text-primary-300 hover:underline">Set as Default Account</button>
        </div>
      )}
      <div className="pt-4 flex justify-between items-center">
        <div>{isEditing && <Button variant="danger-soft" onClick={() => onDelete(accountToEdit.id)}>Delete</Button>}</div>
        <div className="space-x-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : (isEditing ? 'Save Changes' : 'Add Account')}</Button>
        </div>
      </div>
    </form>
  );
};
export default BankAccountForm;
