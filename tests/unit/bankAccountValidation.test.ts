/**
 * Task 64 — bank account validation.
 *
 * The user's standard: every bank account record carries an ACCOUNT NAME,
 * BANK and ACCOUNT NUMBER. Account Name was previously optional, producing
 * anonymous entries and making "which account is this?" unanswerable.
 */
import { describe, it, expect } from 'vitest';
import { validateBankAccountInput } from '../../src/utils/bankAccountValidation';

describe('validateBankAccountInput (Task 64)', () => {
  it('accepts a complete entry and trims all fields', () => {
    const res = validateBankAccountInput({
      accountName: '  Firm Operating Account ',
      bankName: ' Guaranty Trust Bank ',
      accountNumber: ' 0123456789 ',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual({
        accountName: 'Firm Operating Account',
        bankName: 'Guaranty Trust Bank',
        accountNumber: '0123456789',
      });
    }
  });

  it('rejects a missing account name (was optional before — the reported defect)', () => {
    const res = validateBankAccountInput({ accountName: '', bankName: 'GTBank', accountNumber: '0123456789' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('Account Name');
  });

  it('rejects a missing bank name', () => {
    const res = validateBankAccountInput({ accountName: 'Trust Account', bankName: '   ', accountNumber: '0123456789' });
    expect(res.ok).toBe(false);
  });

  it('rejects a missing account number', () => {
    const res = validateBankAccountInput({ accountName: 'Trust Account', bankName: 'GTBank', accountNumber: '' });
    expect(res.ok).toBe(false);
  });

  it('handles null/undefined input defensively', () => {
    expect(validateBankAccountInput(null).ok).toBe(false);
    expect(validateBankAccountInput(undefined).ok).toBe(false);
  });
});
