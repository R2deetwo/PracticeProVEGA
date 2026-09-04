import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProduct } from '../contexts/ProductContext';
import { Product as ProductType } from '../types';
import { useUI } from '../contexts/UIContext';
import { isFeatureAllowed, featureRedirectMessage } from '../utils/productAccess';

/**
 * FeatureGuard — product-scoped view gate.
 *
 * R13 REDESIGN (user report: "the first thing I see [after Atrium signup]
 * is 'Feature not available' … let's not take you to a page where you
 * don't belong").
 *
 * Previously, a blocked user got a full-screen dead-end wall with a
 * "Return to Dashboard" button. That wall was the FIRST screen a fresh
 * Atrium user saw when their tab carried a stale legal URL (e.g. /matters
 * left over from a previous Vega session in the same tab).
 *
 * Now: a blocked user is AUTO-REDIRECTED to the dashboard (history
 * replace — no back-button trap) with a single friendly toast naming the
 * products involved. No wall, no dead end, no "you don't belong here"
 * moment. The access matrix itself is pure, tested logic
 * (src/utils/productAccess.ts).
 */
interface Props {
  requiredProduct: ProductType | ProductType[];
  children: React.ReactNode;
}

export const FeatureGuard: React.FC<Props> = ({ requiredProduct, children }) => {
  const { product } = useProduct();
  const { addToast } = useUI();
  const navigate = useNavigate();

  const allowed = isFeatureAllowed(requiredProduct, product);

  React.useEffect(() => {
    if (allowed) return;
    // Auto-redirect — replace so the stale URL doesn't linger in history
    // (pressing Back lands on the pre-stale-URL entry, not a loop).
    addToast(featureRedirectMessage(requiredProduct, product), { type: 'info', duration: 5000 });
    navigate('/', { replace: true });
    // Intentionally narrow deps: fire exactly once per block transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (allowed) {
    return <>{children}</>;
  }

  // Momentary placeholder while the redirect settles — NEVER a dead-end
  // error card. Light skeleton so it can't flash dark during onboarding.
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-slate-50 p-8">
      <div className="w-10 h-10 border-[3px] border-slate-200 border-t-primary-500 rounded-full animate-spin" role="status" aria-label="Redirecting to dashboard" />
    </div>
  );
};
