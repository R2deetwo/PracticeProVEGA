//
// lazyWithReload — shared lazy-component factory with stale-chunk recovery.
//
// STALE CHUNK RECOVERY: when a new deploy ships, old bundles reference
// chunk files (e.g. WordProcessor-BuK_wFdm.js) that no longer exist on
// the server. The lazy import fails with "Failed to fetch dynamically
// imported module". We catch this and force a page reload so the browser
// picks up the new bundle with the correct chunk hashes.
//
// Extracted from App.tsx in V7 so ModalManager, Sidebar and other eager
// shells can lazy-load their heavy children through the same recovery
// path (V7 A: ModalManager's ~50 static form imports were dragging the
// entire forms + AI-service stack into the entry chunk).
//
import React from 'react';

// Typed so the lazy component keeps the original component's prop types —
// call-site callbacks (`onSave={(data) => …}`) keep their parameter
// inference instead of collapsing to `any` (which trips noImplicitAny on
// ~40 inline handlers in ModalManager).
export const lazyWithReload = <T extends React.ComponentType<any>>(
    factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> =>
    React.lazy(() =>
        factory().catch((err) => {
            // Check if this is a chunk-load failure (stale bundle)
            if (err?.message?.includes('Failed to fetch dynamically imported module') ||
                err?.message?.includes('Loading chunk') ||
                err?.name === 'ChunkLoadError') {
                console.error('[lazy] Stale chunk detected — reloading page to get fresh bundle.', err);
                // Force a hard reload to pick up the new bundle
                window.location.reload();
            }
            throw err;
        })
    );
