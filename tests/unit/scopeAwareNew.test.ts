/**
 * UX-38 part 3 contract tests — the scope-aware New action.
 *
 * The audit (register row UX-38, part 3): "New always opens newInvoice"
 * — the creation entry ignored scoped intent, so a Properties-scope
 * user got the LEGAL composer (wrong-form friction at the revenue
 * moment). The ratified design: in property scope the composer opens
 * property-first — the missing property picker picks the property, the
 * landlord (client), the matter link (real linked matter, else the
 * CollectRentModal pseudo-matter convention) and the origin
 * (product='property') all follow from it. Legal/combined keep the
 * standard composer (the classifier's documented default).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const BILLING = 'src/components/BillingView.tsx';
const LAYER = 'src/overlays/layers/ModalLayer.tsx';
const FORM = 'src/components/forms/InvoiceForm.tsx';

describe('UX-38 part 3: scope-aware New', () => {
    it('BillingView: the New action honors the product scope', () => {
        const billing = read(BILLING);
        expect(billing).toContain("openModal('newInvoice', null, productScope === 'property' ? { propertyIntent: true } : undefined)");
        // Both creation entries are scope-aware: the header button and
        // the invoice list's empty state.
        expect(billing).toMatch(/onClick=\{handleNewInvoice\}/);
        expect(billing).toContain('onAction={onNewInvoice || (() => openModal');
    });

    it('ModalLayer forwards the intent + the picker data into the composer', () => {
        const layer = read(LAYER);
        expect(layer).toContain('propertyIntent={editingId ? false : !!modalContext?.propertyIntent}');
        expect(layer).toContain('properties={coreState.properties || []}');
        expect(layer).toContain('ownerContacts={matterState.contacts || []}');
    });

    it('InvoiceForm: the property picker + landlord resolution + explicit origin', () => {
        const form = read(FORM);
        // The picker (the piece that did not exist).
        expect(form).toContain('const propertyMode = !!propertyIntent && !isEditing && (properties?.length ?? 0) > 0');
        expect(form).toContain('Select property');
        // The landlord is RESOLVED (CollectRentModal convention), never typed.
        expect(form).toContain("c.id === selectedProperty.contactId || (c.properties || []).some(p => p.id === selectedProperty.id)");
        // The matter link: real linked matter, else the pseudo-matter.
        expect(form).toContain("`Property Management — ${selectedProperty!.address}`");
        // The explicit origin — property by construction in this mode.
        expect(form).toContain("product: propertyMode ? 'property' :");
        // No-owner guard: refuse rather than guess a client.
        expect(form).toContain('no linked owner contact');
    });

    it('the property mode is NEW-only — editing an invoice never re-enters the picker', () => {
        const form = read(FORM);
        expect(form).toContain('propertyIntent && !isEditing');
        // The landlord display is a READ-ONLY ui/ Input (ADR-0004 — no raw
        // elements; the ratchet gate stays at baseline).
        expect(form).toMatch(/readOnly\n(\s+)value=\{propertyOwner\.name\}/);
        expect(form).toContain('inputClassName={`${commonInputClass} bg-slate-50 dark:bg-zinc-800`}');
    });
});
