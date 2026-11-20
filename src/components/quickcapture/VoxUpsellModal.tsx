/**
 * VoxUpsellModal — the dedicated upgrade experience for Free-tier users
 * tapping into Vox (owner spec, 2026-11-20: "Restrict Vox to Middle Tier
 * and Above & Implement Clean Upgrade Upsell").
 *
 * WHY A DEDICATED MODAL: the generic UpgradeModal pitches Pro/Komplete.
 * Vox unlocks at GROWTH — the middle tier — so the card names Growth,
 * shows the three Vox-specific value points (verbatim from the owner
 * spec), and routes the Primary CTA straight into the existing
 * billing/Paystack flow with Growth PRE-SELECTED
 * (openModal('paymentGateway', { subscriptionContext.requestedPlan:
 * 'Growth' }) — the same path SubscriptionSettings.processUpgrade uses,
 * so payment verification + plan activation stay server-authoritative).
 *
 * Brand rules: the feature is "Vox" (never "Quick Capture"/"QC"/"Whisper"),
 * "Komplete" is spelled with a K, and the palette is Vega Deep Blue &
 * White in clean light-mode minimalism.
 */

import React, { useMemo } from "react";
import { Button } from "../ui/Button";
import { LockClosedIcon, MicrophoneIcon, UsersIcon, PencilSquareIcon } from "../../constants";
import { Z_CLASS } from "../../overlays/constants";
import { SubscriptionPlan } from "../../types";
import { useUI } from "../../contexts/UIContext";
import { useCoreState } from "../../contexts/CoreContext";
import { useIsProperty } from "../../contexts/ProductContext";
import { VEGA_TIERS, ATRIUM_TIERS } from "../../constants/tiers";

interface VoxUpsellModalProps {
  onClose: () => void;
}

const VALUE_POINTS: { Icon: React.ComponentType<{ className?: string }>; text: string }[] = [
  {
    Icon: MicrophoneIcon,
    text: "Dictate court endorsements, diary deadlines and disbursements hands-free after court.",
  },
  {
    Icon: UsersIcon,
    text: "Automatic speaker detection and 1-tap speaker labelling for client consultations.",
  },
  {
    Icon: PencilSquareIcon,
    text: "Hybrid Legal Pad merges spoken consultations with typed notes and sends drafts straight to DraftPro.",
  },
];

export const VoxUpsellModal: React.FC<VoxUpsellModalProps> = ({ onClose }) => {
  const { openModal } = useUI();
  const { coreState } = useCoreState();
  const isProperty = useIsProperty();

  const growthPrice = useMemo(() => {
    const tiers = isProperty ? ATRIUM_TIERS : VEGA_TIERS;
    const g = tiers.Growth;
    if (!g) return null;
    return {
      monthly: g.monthlyPriceDisplay,
      annual: g.annualPriceDisplay,
    };
  }, [isProperty]);

  const handleUpgrade = () => {
    // Same server-authoritative flow as SubscriptionSettings upgrades:
    // the paymentGateway modal writes the subscriptionRequest (Paystack
    // inline when configured, bank transfer otherwise) and the plan only
    // flips on webhook/verified payment. Growth is PRE-SELECTED.
    openModal("paymentGateway", null, {
      amount: growthPrice?.annual ?? 0,
      title: "Upgrade to Growth",
      description: `${coreState.firmDetails?.name || "Your firm"} — unlocks Vox voice capture and the full Growth feature set`,
      forcePracticeProAccount: true,
      subscriptionContext: {
        requestedPlan: SubscriptionPlan.Growth,
        billingInterval: "annual",
        firmId: coreState.firmDetails?.id || "",
      },
      onConfirm: () => {
        // The gateway modal handles the request + toasts.
      },
    });
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 ${Z_CLASS.modal} flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-0 sm:p-6`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vox-upsell-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header — Vega Deep Blue on White, clean light-mode minimalism */}
        <div className="px-6 pt-6 pb-5 text-center bg-gradient-to-b from-primary-600 to-[#1E3A8A] text-white">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
            <LockClosedIcon className="w-6 h-6 text-white" />
          </div>
          <h3 id="vox-upsell-title" className="text-lg font-black leading-snug">
            Unlock Vox — Voice-First Legal Capture
          </h3>
          <p className="text-sm text-white/80 mt-1">Available on Growth and above.</p>
        </div>

        {/* Value points — the three from the owner spec, verbatim substance */}
        <div className="px-6 py-5 space-y-4">
          {VALUE_POINTS.map(({ Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 border border-primary-100 shrink-0">
                <Icon className="w-4 h-4 text-primary-600" />
              </span>
              <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* Price hint + CTAs */}
        <div className="px-6 pb-6 pt-1">
          {growthPrice ? (
            <p className="text-center text-xs text-slate-400 mb-4">
              Growth — {growthPrice.monthly}/mo monthly or {growthPrice.annual}/yr annual
            </p>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            minTouchTarget
            className="!bg-primary-600 hover:!bg-[#1E3A8A]"
            onClick={handleUpgrade}
          >
            Upgrade to Growth
          </Button>
          <Button
            variant="ghost"
            size="md"
            fullWidth
            className="mt-2 text-slate-500"
            onClick={onClose}
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
};
