/**
 * Message total-scope fix — regression tests.
 *
 * USER BUG (2026-09-08): "I'm talking about the service charge but it
 * adds up figures it ought not to have added." A Service Charge Alert
 * about ₦40,000 ended with "Total Payable: ₦1,920,000" because EVERY
 * template's {{TOTAL_PAYABLE}} summed rent + service charge + caution
 * deposit + legal + agency — regardless of what the message was about.
 *
 * These tests pin the contract now declared in MSG_TYPE_FINANCE
 * (src/utils/messageTypes.ts) and enforced by buildMessage
 * (src/utils/messageTemplates.ts):
 *   • a targeted message totals ONLY the figure it is about;
 *   • a payment receipt states ONLY the amount received (a receipt
 *     claiming ₦1.92M was received for a ₦40k payment is a legal
 *     misstatement, not just a UX wart);
 *   • formal demands legitimately total the full breakdown;
 *   • free-form messages state no total at all.
 */
import { describe, it, expect } from 'vitest';
import { buildMessage } from '../../src/utils/messageTemplates';
import {
  MSG_TYPE_FINANCE,
  getTypeFinance,
  MSG_TYPE_LABELS,
} from '../../src/utils/messageTypes';
import { AutomationMessageType } from '../../src/types';

// The resident from the bug report: rent ₦1.4M, service charge ₦40k,
// caution ₦200k, legal ₦140k, agency ₦140k → grand total ₦1.92M.
const FIGURES = {
  amount: 1400000,
  serviceCharge: 40000,
  cautionDeposit: 200000,
  legalFee: 140000,
  agencyFee: 140000,
};
const GRAND_TOTAL = 1920000;
const extraData = {
  serviceCharge: FIGURES.serviceCharge,
  legalFee: FIGURES.legalFee,
  agencyFee: FIGURES.agencyFee,
  cautionDeposit: FIGURES.cautionDeposit,
  dueDate: '2026-10-01',
  firmName: 'Test Firm',
};

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

describe('buildMessage — TOTAL SCOPE (the "wrong figures added" fix)', () => {
  it('service charge alert totals the service charge ONLY — the reported bug', () => {
    const msg = buildMessage(
      'service_charge_alert', 'Unit 1', 'Mr. Chigozie Ubah',
      FIGURES.amount, undefined, undefined, extraData
    );
    expect(msg).toContain(`service charge of ${naira(40000)}`);
    expect(msg).toContain(`Total Payable: ${naira(40000)}`);
    // The grand total (rent + every fee) must NOT appear anywhere.
    expect(msg).not.toContain(naira(GRAND_TOTAL));
    expect(msg).not.toContain(naira(FIGURES.amount));
  });

  it('payment receipt states ONLY the amount received — never adds unrelated charges', () => {
    const msg = buildMessage(
      'payment_receipt', 'Unit 1', 'Resident',
      FIGURES.amount, undefined, undefined, extraData
    );
    expect(msg).toContain(`receipt of ${naira(1400000)}`);
    expect(msg).not.toContain(naira(GRAND_TOTAL));
    expect(msg).not.toContain(naira(40000));
  });

  it('rent reminder (formal demand) still totals the full breakdown', () => {
    const msg = buildMessage(
      'rent_reminder', 'Unit 1', 'Resident',
      FIGURES.amount, undefined, undefined, extraData
    );
    expect(msg).toContain(`Total Payable: ${naira(GRAND_TOTAL)}`);
    expect(msg).toContain(`- Rent: ${naira(1400000)}`);
    expect(msg).toContain(`- Service Charge: ${naira(40000)}`);
    expect(msg).toContain(`- Caution Deposit: ${naira(200000)}`);
    expect(msg).toContain(`- Legal/Agency Fees: ${naira(280000)}`);
  });

  it('late notice / access restriction / penalty notice total the full outstanding balance', () => {
    for (const type of ['late_notice', 'access_restriction', 'penalty_notice'] as AutomationMessageType[]) {
      const msg = buildMessage(type, 'Unit 1', 'Resident', FIGURES.amount, undefined, undefined, extraData);
      expect(msg).toContain(naira(GRAND_TOTAL));
      expect(msg).not.toContain(`{{TOTAL_PAYABLE}}`);
    }
  });

  it('free-form message types state no total and leak no figures', () => {
    for (const type of ['custom', 'welcome_note', 'general_announcement'] as AutomationMessageType[]) {
      const msg = buildMessage(type, 'Unit 1', 'Resident', FIGURES.amount, undefined, undefined, extraData);
      expect(msg).not.toContain('Total Payable');
      expect(msg).not.toContain(naira(GRAND_TOTAL));
      expect(msg).not.toContain(naira(40000));
    }
  });

  it('a firm custom template key keeps the legacy full-sum total', () => {
    // Unknown keys are firm-defined templates; existing custom
    // {{TOTAL_PAYABLE}} placeholders must keep rendering the full sum.
    const templates = {
      firm_special_notice: 'Your total: {{TOTAL_PAYABLE}} for {{PROPERTY_ADDRESS}}',
    };
    const msg = buildMessage(
      'firm_special_notice' as AutomationMessageType, 'Unit 1', 'Resident',
      FIGURES.amount, undefined, templates, extraData
    );
    expect(msg).toContain(`Your total: ${naira(GRAND_TOTAL)} for Unit 1`);
  });

  it('no template ships unreplaced placeholders', () => {
    for (const [type] of Object.entries(MSG_TYPE_LABELS)) {
      const msg = buildMessage(
        type as AutomationMessageType, 'Unit 1', 'Resident',
        FIGURES.amount, undefined, undefined, extraData
      );
      expect(msg).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
  });
});

describe('MSG_TYPE_FINANCE — configuration invariants', () => {
  it('declares an entry for every message type', () => {
    for (const key of Object.keys(MSG_TYPE_LABELS)) {
      expect(MSG_TYPE_FINANCE[key as AutomationMessageType]).toBeDefined();
    }
  });

  it('every field included in a type\u2019s total is also shown in the composer', () => {
    // A total must never include a figure the user cannot see and edit.
    for (const [key, f] of Object.entries(MSG_TYPE_FINANCE)) {
      for (const t of f.total) {
        expect(f.fields).toContain(t);
      }
    }
  });

  it('unknown keys fall back to the free-form (no figures) config', () => {
    expect(getTypeFinance('firm_custom_key').fields).toEqual([]);
    expect(getTypeFinance('firm_custom_key').total).toEqual([]);
  });

  it('service charge alert and payment receipts are the targeted shapes', () => {
    expect(MSG_TYPE_FINANCE.service_charge_alert).toMatchObject({
      fields: ['serviceCharge', 'dueDate'],
      total: ['serviceCharge'],
    });
    expect(MSG_TYPE_FINANCE.payment_receipt).toMatchObject({
      fields: ['amount', 'dueDate'],
      total: ['amount'],
    });
  });
});
