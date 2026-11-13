/**
 * UX-36 contract tests — the tenancy lifecycle panel is the write path.
 *
 * The audit (register row UX-36): the property form writes tenancy fields
 * into the rentalDetails SNAPSHOT while the tenancy ledger holds truth —
 * stale snapshots sit beside ledger truth and renewal decisions read the
 * wrong one. The ratified design (the audit's own recommendation):
 * lifecycle panel = write path (its mutations write the ledger AND sync
 * the snapshot via mergeRd); the form renders the resident/lease fields
 * read-only with a jump link whenever the unit has an ACTIVE ledger row.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const FORM = 'src/components/forms/PropertyForm.tsx';
const PANEL = 'src/components/details/TenancyLifecyclePanel.tsx';

describe('UX-36: tenancy write-path', () => {
    it('the form reads the SAME ledger-status feed the panel renders from', () => {
        const form = read(FORM);
        expect(form).toContain("import { useUnitsTenancyStatus } from '../details/TenancyLifecyclePanel'");
        expect(form).toContain('useUnitsTenancyStatus(coreState.firmDetails?.id');
        // The lock is per-ACTIVE-ledger-row, not per-snapshot — units
        // without a ledger row (new, un-let, pre-ledger) stay writable.
        expect(form).toMatch(/tenancyLocked = !!\(tenancyStatus\?\.\[String\(activeUnit\?\.id \?\? ''\)\]\?\.active\)/);
    });

    it('every resident/lease field is disabled under the lock', () => {
        const form = read(FORM);
        const disabledCount = (form.match(/disabled=\{tenancyLocked\}/g) || []).length;
        // Resident name (2) + phone + email + lease start + tenancy
        // period + lease end = 7 controls.
        expect(disabledCount).toBe(7);
        // And they LOOK disabled.
        expect(form).toContain("const tenancyLockedInputClass = 'disabled:opacity-60 disabled:cursor-not-allowed'");
    });

    it('the lock notice carries the one affordance: jump to the Units tab panel', () => {
        const form = read(FORM);
        expect(form).toContain('This unit has an active tenancy record');
        expect(form).toContain("navigateTo('propertyDetail', propertyToEdit!.id, { tab: 'units', targetUnit:");
        expect(form).toContain('Manage tenancy in Units tab');
    });

    it('the panel remains the ledger write path (mutations untouched)', () => {
        const panel = read(PANEL);
        expect(panel).toContain('useMutation(api.tenancyLifecycle.allocateTenant)');
        // The denormalized snapshot sync that makes read-only display
        // truthful: the ledger writes flow back into rentalDetails
        // (server side — convex/tenancyLifecycle.ts).
        const server = read('convex/tenancyLifecycle.ts');
        expect(server).toContain('mergeRd');
        expect(server).toMatch(/patch\.rentalDetails = mergeRd/);
    });
});
