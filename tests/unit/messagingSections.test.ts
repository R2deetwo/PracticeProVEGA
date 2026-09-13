/**
 * Messaging sections — collapse defaults + scheduled-message classification.
 *
 * Covers the USER DIRECTIVE (2026-09-14):
 *  - Conversations start fully COLLAPSED except one smart-default section
 *    (no team → PracticePro support; Atrium → Residents; Vega → Clients).
 *  - The user's manual collapse layout persists and is restored.
 *  - Payment receipts and other system traffic classify as automation, not
 *    human-scheduled messages (the "why are receipts scheduled?" fix).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  INBOX_SECTION_IDS,
  getSmartDefaultOpenSection,
  refineDefaultOpenSection,
  computeInitialCollapsed,
  collapsedStorageKey,
  loadPersistedCollapsed,
  persistCollapsed,
  isSystemGeneratedMessage,
  partitionScheduledMessages,
  isDueNow,
} from '../../src/messaging/sections';

const baseCtx = {
  isAtrium: false,
  hasTeam: true,
  hasSupportThread: true,
  hasClientsSection: true,
  hasResidentsSection: false,
};

describe('getSmartDefaultOpenSection (first-visit default)', () => {
  it('opens the PracticePro support section when the user has no team', () => {
    expect(getSmartDefaultOpenSection({ ...baseCtx, hasTeam: false })).toBe('system');
  });

  it('opens Residents for an Atrium firm with a team', () => {
    expect(
      getSmartDefaultOpenSection({ ...baseCtx, isAtrium: true, hasResidentsSection: true })
    ).toBe('portal_residents');
  });

  it('opens Clients for a Vega firm', () => {
    expect(getSmartDefaultOpenSection({ ...baseCtx })).toBe('portal_clients');
  });

  it('opens Clients for a Komplete (unified) firm', () => {
    expect(
      getSmartDefaultOpenSection({ ...baseCtx, hasResidentsSection: true })
    ).toBe('portal_clients');
  });

  it('keeps PracticePro Team open for a teamless user with no support thread yet (section always renders now)', () => {
    expect(
      getSmartDefaultOpenSection({
        ...baseCtx,
        hasTeam: false,
        hasSupportThread: false,
        isAtrium: true,
        hasResidentsSection: true,
      })
    ).toBe('system');
  });

  it('returns null (everything collapsed) when nothing relevant renders', () => {
    expect(
      getSmartDefaultOpenSection({
        ...baseCtx,
        hasClientsSection: false,
        hasResidentsSection: false,
      })
    ).toBeNull();
  });
});

describe('computeInitialCollapsed', () => {
  it('collapses every section except the open one', () => {
    const collapsed = computeInitialCollapsed('portal_clients');
    expect(collapsed.has('portal_clients')).toBe(false);
    expect(collapsed.size).toBe(INBOX_SECTION_IDS.length - 1);
  });

  it('collapses everything when no section qualifies', () => {
    const collapsed = computeInitialCollapsed(null);
    expect(collapsed.size).toBe(INBOX_SECTION_IDS.length);
  });
});

describe('collapse persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: {
        store: new Map<string, string>(),
        getItem(k: string) { return this.store.get(k) ?? null; },
        setItem(k: string, v: string) { this.store.set(k, v); },
      },
    });
  });

  it('round-trips a collapsed set through localStorage', () => {
    persistCollapsed('user-1', new Set(['system', 'team'] as any));
    const loaded = loadPersistedCollapsed('user-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.has('system')).toBe(true);
    expect(loaded!.has('team')).toBe(true);
    expect(loaded!.has('portal_clients')).toBe(false);
  });

  it('returns null when nothing was stored', () => {
    expect(loadPersistedCollapsed('user-2')).toBeNull();
  });

  it('ignores stored junk (wrong shape / unknown ids)', () => {
    window.localStorage.setItem(collapsedStorageKey('user-3'), '{"oops":true}');
    expect(loadPersistedCollapsed('user-3')).toBeNull();
    window.localStorage.setItem(collapsedStorageKey('user-4'), '["not-a-section"]');
    expect(loadPersistedCollapsed('user-4')).toBeNull();
  });

  it('keys the state per user', () => {
    persistCollapsed('user-a', new Set(['system'] as any));
    expect(loadPersistedCollapsed('user-b')).toBeNull();
  });
});

describe('isSystemGeneratedMessage (why receipts look scheduled)', () => {
  it('classifies cron/system receipts as automation', () => {
    expect(isSystemGeneratedMessage({ triggeredBy: 'system_cron' })).toBe(true);
    expect(isSystemGeneratedMessage({ triggeredBy: 'admin_mark_paid' })).toBe(true);
    expect(isSystemGeneratedMessage({ triggeredBy: 'cron_service_charge_reminder' })).toBe(true);
    expect(isSystemGeneratedMessage({ triggeredBy: 'system' })).toBe(true);
    expect(isSystemGeneratedMessage({ isAutomation: true })).toBe(true);
  });

  it('classifies human-scheduled rows as personal', () => {
    expect(isSystemGeneratedMessage({ triggeredBy: 'founder@firm.ng' })).toBe(false);
    expect(isSystemGeneratedMessage({ triggeredBy: 'usr_12345' })).toBe(false);
    expect(isSystemGeneratedMessage({})).toBe(false);
    expect(isSystemGeneratedMessage(null)).toBe(false);
  });
});

describe('partitionScheduledMessages', () => {
  const t = (mins: number) => Date.now() + mins * 60_000;
  const rows = [
    { _id: 'a', status: 'scheduled', triggeredBy: 'me@firm.ng', scheduledFor: t(60) },
    { _id: 'b', status: 'scheduled', triggeredBy: 'admin_mark_paid', scheduledFor: t(1), messageType: 'payment_receipt' },
    { _id: 'c', status: 'sent', triggeredBy: 'me@firm.ng', scheduledFor: t(-60) },
    { _id: 'd', status: 'scheduled', isAutomation: true, scheduledFor: t(30) },
    { _id: 'e', status: 'cancelled', triggeredBy: 'me@firm.ng', scheduledFor: t(-5) },
  ];

  it('splits into mine / automationQueue / history', () => {
    const { mine, automationQueue, history } = partitionScheduledMessages(rows);
    expect(mine.map((m: any) => m._id)).toEqual(['a']);
    expect(automationQueue.map((m: any) => m._id)).toEqual(['b', 'd']); // ascending by time
    expect(history.map((m: any) => m._id).sort()).toEqual(['c', 'e']);
  });

  it('handles empty / null input', () => {
    const p = partitionScheduledMessages([]);
    expect(p.mine).toHaveLength(0);
    expect(p.automationQueue).toHaveLength(0);
    expect(p.history).toHaveLength(0);
    expect(() => partitionScheduledMessages(null as any)).not.toThrow();
  });
});

describe('isDueNow', () => {
  it('marks past and imminent sends as due', () => {
    expect(isDueNow({ scheduledFor: Date.now() - 5000 })).toBe(true);
    expect(isDueNow({ scheduledFor: Date.now() + 30_000 })).toBe(true);
    expect(isDueNow({ scheduledFor: Date.now() + 10 * 60_000 })).toBe(false);
  });
});

describe('refineDefaultOpenSection guards', () => {
  it('never opens inbound/team/client sections', () => {
    expect(refineDefaultOpenSection('team' as any, baseCtx)).toBeNull();
    expect(refineDefaultOpenSection('inbound' as any, baseCtx)).toBeNull();
    expect(refineDefaultOpenSection('client' as any, baseCtx)).toBeNull();
  });

  it('cross-falls-back between Clients and Residents when one is hidden', () => {
    expect(
      refineDefaultOpenSection('portal_clients', { ...baseCtx, hasClientsSection: false, hasResidentsSection: true })
    ).toBe('portal_residents');
    expect(
      refineDefaultOpenSection('portal_residents', { ...baseCtx, hasResidentsSection: false })
    ).toBe('portal_clients');
    expect(
      refineDefaultOpenSection('portal_clients', { ...baseCtx, hasClientsSection: false, hasResidentsSection: false })
    ).toBeNull();
  });
});
