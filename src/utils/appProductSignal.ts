/**
 * appProductSignal — a tiny synchronous bridge for the resolved product.
 *
 * R29 (owner direction): logging out of the workspace must land on the
 * user's OWN product page — a Vega firm signs out to /vega, an Atrium
 * firm to /atrium — not the company hub. But AuthContext (where logout
 * lives) is a PARENT of ProductProvider (where the firm's product is
 * resolved from firmDetails + the user record + the demo switcher), so
 * logout cannot call useProduct(). Importing ProductContext from
 * AuthContext would create a module cycle.
 *
 * Instead, ProductProvider publishes its resolved product here (a plain
 * module-scoped value — no reactivity needed; logout reads it exactly
 * once, synchronously, at the moment of sign-out), and AuthContext
 * consumes it as the PRIMARY source, falling back to the user record's
 * own product field, and finally to the hub.
 *
 * The mapping (mirrors useAppProductIdentity's resolution):
 *   'vega' | 'legal'            → /vega
 *   'atrium' | 'property'       → /atrium
 *   'unified' | 'komplete'      → /  (Komplete is the whole workspace —
 *                                    the company hub is its landing page)
 */

let activeAppProduct: string | null = null;

export function setActiveAppProduct(product: string | null): void {
    activeAppProduct = product;
}

export function getActiveAppProduct(): string | null {
    return activeAppProduct;
}

/** The landing page a sign-out from this product should land on. */
export function productLandingPath(product: string | null | undefined): string {
    if (!product) return '/';
    const p = product === 'legal' ? 'vega' : product === 'property' ? 'atrium' : product;
    if (p === 'vega') return '/vega';
    if (p === 'atrium') return '/atrium';
    return '/'; // 'unified' / 'komplete' / anything unresolved → the hub
}
