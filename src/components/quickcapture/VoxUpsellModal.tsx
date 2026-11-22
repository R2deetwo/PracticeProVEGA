/**
 * VoxUpsellModal — the dedicated upgrade experience for Free- and
 * Growth-tier users tapping into Vox (owner spec 2026-11-20: "Restrict
 * Vox to Middle Tier and Above & Implement Clean Upgrade Upsell";
 * RE-TARGETED 2026-11-23 per owner direction: "Aloa Vox should now be
 * in Pro. It should be in Pro, not in Growth anymore.").
 *
 * WHY A DEDICATED MODAL: the generic UpgradeModal pitches Pro/Komplete.
 * Vox unlocks at PRO — so the card names Pro, shows the three
 * Vox-specific value points (verbatim from the owner spec), and routes
 * the Primary CTA straight into the existing billing/Paystack flow with
 * Pro PRE-SELECTED (openModal('paymentGateway', {
 * subscriptionContext.requestedPlan: 'Pro' }) — the same path
 * SubscriptionSettings.processUpgrade uses, so payment verification +
 * plan activation stay server-authoritative).
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

  const proPrice = useMemo(() => {
    const tiers = isProperty ? ATRIUM_TIERS : VEGA_TIERS;
    const p = tiers.Pro;
    if (!p) return null;
    return {
      monthly: p.monthlyPriceDisplay,
      annual: p.annualPriceDisplay,
    };
  }, [isProperty]);

  const handleUpgrade = () => {
    // Same server-authoritative flow as SubscriptionSettings upgrades:
    // the paymentGateway modal writes the subscriptionRequest (Paystack
    // inline when configured, bank transfer otherwise) and the plan only
    // flips on webhook/verified payment. Pro is PRE-SELECTED (Vox is a
    // Pro feature — owner direction, 2026-11-23).
    openModal("paymentGateway", null, {
      amount: proPrice?.annual ?? 0,
      title: "Upgrade to Pro",
      description: `${coreState.firmDetails?.name || "Your firm"} — unlocks ALOA Vox voice capture and the full Pro feature set`,
      forcePracticeProAccount: true,
      subscriptionContext: {
        requestedPlan: SubscriptionPlan.Pro,
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
            Unlock ALOA Vox — Voice-First Legal Capture
          </h3>
          <p className="text-sm text-white/80 mt-1">Available on Pro and above.</p>
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
          {proPrice ? (
            <p className="text-center text-xs text-slate-400 mb-4">
              Pro — {proPrice.monthly}/mo monthly or {proPrice.annual}/yr annual
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
            Upgrade to Pro
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
