import { CommunicationIntegration, CommunicationProvider, IntegrationStatus, ChakraHQConfig } from '../types';

/**
 * Communication Integration Service
 * 
 * Manages the connection between PracticePro and communication providers
 * (ChakraHQ, Twilio, etc.) with plan estimation for onboarding.
 */

// ChakraHQ plan limits (based on actual ChakraHQ pricing)
const CHAKRA_PLANS = {
  free: {
    label: 'Free',
    whatsappLimit: 1000,
    smsLimit: 100,
    emailLimit: 100,
    cost: 0,
    currency: 'NGN',
    period: 'month',
    features: ['WhatsApp Business API', '1 Phone Number', 'Basic Templates', '1000 WhatsApp messages/mo'],
    recommendedFor: 'Atrium Core — up to 15 units (100 WhatsApp notices/mo)',
  },
  starter: {
    label: 'Starter',
    whatsappLimit: 5000,
    smsLimit: 500,
    emailLimit: 1000,
    cost: 15000,
    currency: 'NGN',
    period: 'month',
    features: ['WhatsApp Business API', '2 Phone Numbers', 'Custom Templates', '5000 WhatsApp messages/mo', 'SMS support', 'Priority delivery'],
    recommendedFor: 'Atrium Growth — up to 35 units (500 WhatsApp notices/mo)',
  },
  pro: {
    label: 'Professional',
    whatsappLimit: 0, // unlimited
    smsLimit: 2000,
    emailLimit: 0, // unlimited
    cost: 45000,
    currency: 'NGN',
    period: 'month',
    features: ['WhatsApp Business API', '5 Phone Numbers', 'Custom Templates', 'Unlimited WhatsApp', '2000 SMS/mo', 'Priority delivery', 'Analytics dashboard', 'Multi-agent support'],
    recommendedFor: 'Atrium Pro — up to 100 units (unlimited WhatsApp notices)',
  },
  enterprise: {
    label: 'Enterprise',
    whatsappLimit: 0, // unlimited
    smsLimit: 0, // unlimited
    emailLimit: 0, // unlimited
    cost: 0, // custom
    currency: 'NGN',
    period: 'month',
    features: ['Everything in Pro', 'Unlimited everything', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee'],
    recommendedFor: 'Atrium Enterprise — 100+ units or custom volume',
  },
};

export type ChakraPlanKey = keyof typeof CHAKRA_PLANS;

/**
 * Estimate the recommended ChakraHQ plan based on the firm's portfolio size.
 * This is used during onboarding to help the onboarding person advise the client.
 */
export function estimateChakraPlan(
  totalUnits: number,
  avgMonthlyMessages: number, // estimated messages per unit per month (usually 2-4)
  usesSMS: boolean = false,
  usesEmail: boolean = true,
): {
  recommendedPlan: ChakraPlanKey;
  estimatedMonthlyMessages: number;
  estimatedMonthlyCost: number;
  reasoning: string;
  planDetails: typeof CHAKRA_PLANS[ChakraPlanKey];
  alternatives: { plan: ChakraPlanKey; why: string }[];
} {
  const estimatedMonthlyMessages = totalUnits * avgMonthlyMessages;
  
  let recommendedPlan: ChakraPlanKey;
  let reasoning: string;

  if (totalUnits <= 15 && estimatedMonthlyMessages <= 100) {
    recommendedPlan = 'free';
    reasoning = `With ${totalUnits} units and ~${estimatedMonthlyMessages} monthly messages, Chakra Free aligns with Atrium Core (100 WhatsApp notices/mo on PracticePro).`;
  } else if (totalUnits <= 35 && estimatedMonthlyMessages <= 500) {
    recommendedPlan = 'starter';
    reasoning = `With ${totalUnits} units and ~${estimatedMonthlyMessages} monthly messages, Chakra Starter aligns with Atrium Growth (500 WhatsApp notices/mo).`;
  } else if (totalUnits <= 100) {
    recommendedPlan = 'pro';
    reasoning = `With ${totalUnits} units, you need unlimited WhatsApp messaging and multi-agent support. The Professional plan is designed for agencies at your scale.`;
  } else {
    recommendedPlan = 'enterprise';
    reasoning = `With ${totalUnits}+ units, you need unlimited messaging across all channels with dedicated support. Enterprise provides custom scaling.`;
  }

  const alternatives: { plan: ChakraPlanKey; why: string }[] = [];
  
  // Suggest downgrade if close to boundary
  if (recommendedPlan === 'starter' && estimatedMonthlyMessages <= 900) {
    alternatives.push({ plan: 'free', why: 'If you send fewer messages than estimated, Free might still work. Monitor usage in the first month.' });
  }
  if (recommendedPlan === 'free' && estimatedMonthlyMessages >= 700) {
    alternatives.push({ plan: 'starter', why: 'If you plan to send more automated reminders, Starter prevents hitting the free limit mid-month.' });
  }
  if (recommendedPlan === 'pro' && totalUnits <= 60) {
    alternatives.push({ plan: 'starter', why: 'If most messages are WhatsApp-only and you can stay under 5000/mo, Starter could save you ₦30K/mo.' });
  }

  return {
    recommendedPlan,
    estimatedMonthlyMessages,
    estimatedMonthlyCost: CHAKRA_PLANS[recommendedPlan].cost,
    reasoning,
    planDetails: CHAKRA_PLANS[recommendedPlan],
    alternatives,
  };
}

/**
 * Derive the integration status from configuration.
 * This is computed, not stored.
 */
export function deriveIntegrationStatus(config?: ChakraHQConfig): IntegrationStatus {
  if (!config) return 'not_configured';
  if (!config.isActive) return 'disconnected';
  if (config.apiKeySet && config.accountId) return 'connected';
  if (config.accountId && !config.apiKeySet) return 'simulated';
  return 'not_configured';
}

/**
 * Get the available channels based on the current plan.
 */
export function getAvailableChannels(plan?: ChakraPlanKey): ('whatsapp' | 'email' | 'sms')[] {
  const channels: ('whatsapp' | 'email' | 'sms')[] = ['email']; // email always available
  if (plan && plan !== 'free' && (plan as any) !== 'none') {
    channels.push('whatsapp');
  }
  if (plan && plan !== 'free' && (plan as any) !== 'none') {
    channels.push('sms');
  }
  return channels;
}

/**
 * Get ChakraHQ plan details for display.
 */
export function getChakraPlanDetails(plan: ChakraPlanKey) {
  return CHAKRA_PLANS[plan];
}

/**
 * Get all ChakraHQ plans for comparison.
 */
export function getAllChakraPlans() {
  return Object.entries(CHAKRA_PLANS).map(([key, details]) => ({
    key: key as ChakraPlanKey,
    ...details,
  }));
}
