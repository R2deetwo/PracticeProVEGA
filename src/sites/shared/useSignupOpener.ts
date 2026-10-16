import { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { normalizeSignupProduct } from '../../utils/signupProduct';
import type { ProductMode } from '../../constants/tiers';

/**
 * useSignupOpener — the signup funnel entry, moved verbatim from
 * LandingPage.tsx (P0 split). Each site passes its own product context:
 * null on the hub (the modal opens at the product-selection step), or the
 * site's product id on /vega and /atrium (the modal goes straight to the
 * registration form).
 *
 * TASK 54 (2026-09-17 live incident): ONLY known product ids are accepted
 * as overrides — anything else (click events, objects, garbage) is
 * treated as "no override", so wiring this directly to onClick is safe.
 */
export function useSignupOpener(product: 'vega' | 'atrium' | null) {
    const { openModal } = useUI();
    return (productOverride?: ProductMode | unknown) => {
        const override = normalizeSignupProduct(productOverride);
        const chosen = product ? normalizeSignupProduct(product) : null;
        const selected = override || chosen;
        openModal('signup', null, {
            selectedProduct: selected,
            forceProductSelection: !selected,
            // R27: the modal carries the opening page's identity — a signup
            // started on /vega or /atrium renders in that product's register.
            productTheme: product ?? 'hub',
        });
    };
}

/**
 * useContactSales — the Contact Sales drawer state (source string feeds
 * the drawer's analytics). Moved verbatim from LandingPage.tsx.
 */
export function useContactSales() {
    const [isContactDrawerOpen, setIsContactDrawerOpen] = useState(false);
    const [contactDrawerSource, setContactDrawerSource] = useState('landing_page');
    const openContactSales = (source: string) => {
        setContactDrawerSource(source);
        setIsContactDrawerOpen(true);
    };
    return {
        isContactDrawerOpen,
        contactDrawerSource,
        openContactSales,
        closeContactSales: () => setIsContactDrawerOpen(false),
    };
}
