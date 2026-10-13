import React from 'react';
import { HubSite } from '../sites/hub';
import { VegaSite } from '../sites/vega';
import { AtriumSite } from '../sites/atrium';

/**
 * LandingPage — the marketing surface ROUTER (P0 sites split).
 *
 * App.tsx passes `initialProduct` derived from the URL ('/vega', '/atrium',
 * or undefined on '/'). This component now only picks the surface; each
 * site owns its chrome, sections, effects and identity:
 *
 *   src/sites/hub/     the PracticePro corporate home (/)
 *   src/sites/vega/    Vega — The Chambers Standard (/vega)
 *   src/sites/atrium/  Atrium — The Well-Kept Estate (/atrium)
 *   src/sites/shared/  cross-surface machinery (drawer, scroll, signup)
 *
 * The key forces a full remount on surface switch — every site starts at
 * the top of its own scroll container, matching the pre-split behaviour
 * of resetting scroll on hub arrival (and improving the rare in-tab
 * product-to-product switch, which previously preserved stale scroll).
 *
 * Same exported name and props as the pre-split component (2,893 lines);
 * see git history for the original implementation.
 */
export const LandingPage: React.FC<{ initialProduct?: 'vega' | 'atrium' }> = ({ initialProduct }) =>
    initialProduct === 'vega' ? (
        <VegaSite key="vega" />
    ) : initialProduct === 'atrium' ? (
        <AtriumSite key="atrium" />
    ) : (
        <HubSite key="hub" />
    );
