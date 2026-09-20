/**
 * bankAccountValidation — shared client-side validation for bank account
 * entries (Task 64).
 *
 * The user's standard: every account record carries an ACCOUNT NAME, BANK
 * and ACCOUNT NUMBER (name was previously optional, producing anonymous
 * "- — GTBank" rows in the firm's account list). All fields are trimmed.
 */
export interface BankAccountInput {
  accountName: string;
  bankName: string;
  accountNumber: string;
}

export type BankAccountValidationResult =
  | { ok: true; value: BankAccountInput }
  | { ok: false; error: string };

export const validateBankAccountInput = (
  input: Partial<BankAccountInput> | undefined | null
): BankAccountValidationResult => {
  const accountName = (input?.accountName || '').trim();
  const bankName = (input?.bankName || '').trim();
  const accountNumber = (input?.accountNumber || '').trim();

  if (!accountName || !bankName || !accountNumber) {
    return {
      ok: false,
      error: 'Account Name, Bank Name and Account Number are all required.',
    };
  }

  return { ok: true, value: { accountName, bankName, accountNumber } };
};
