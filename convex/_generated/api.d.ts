/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as analytics from "../analytics.js";
import type * as authHelpers from "../authHelpers.js";
import type * as authUtils from "../authUtils.js";
import type * as backups from "../backups.js";
import type * as brainIngestion from "../brainIngestion.js";
import type * as broadcasts from "../broadcasts.js";
import type * as communications from "../communications.js";
import type * as conversationMemory from "../conversationMemory.js";
import type * as crons from "../crons.js";
import type * as debug_env from "../debug_env.js";
import type * as drafting from "../drafting.js";
import type * as embeddings from "../embeddings.js";
import type * as estateCommunity from "../estateCommunity.js";
import type * as feedback from "../feedback.js";
import type * as founderMetrics from "../founderMetrics.js";
import type * as founderNotifications from "../founderNotifications.js";
import type * as http from "../http.js";
import type * as impersonation from "../impersonation.js";
import type * as indexer from "../indexer.js";
import type * as legalRepo from "../legalRepo.js";
import type * as migrations from "../migrations.js";
import type * as moneyUtils from "../moneyUtils.js";
import type * as myFunctions from "../myFunctions.js";
import type * as payments from "../payments.js";
import type * as paystack from "../paystack.js";
import type * as portalSecurity from "../portalSecurity.js";
import type * as portals from "../portals.js";
import type * as proactive from "../proactive.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as pushNotificationsNode from "../pushNotificationsNode.js";
import type * as retainerBilling from "../retainerBilling.js";
import type * as salesInquiries from "../salesInquiries.js";
import type * as securityHelpers from "../securityHelpers.js";
import type * as seedLegalRepo from "../seedLegalRepo.js";
import type * as seedSentry from "../seedSentry.js";
import type * as sentry from "../sentry.js";
import type * as sentryWebhook from "../sentryWebhook.js";
import type * as tierLimits from "../tierLimits.js";
import type * as trustAccount from "../trustAccount.js";
import type * as visitorManagement from "../visitorManagement.js";
import type * as wallets from "../wallets.js";
import type * as webFetch from "../webFetch.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  analytics: typeof analytics;
  authHelpers: typeof authHelpers;
  authUtils: typeof authUtils;
  backups: typeof backups;
  brainIngestion: typeof brainIngestion;
  broadcasts: typeof broadcasts;
  communications: typeof communications;
  conversationMemory: typeof conversationMemory;
  crons: typeof crons;
  debug_env: typeof debug_env;
  drafting: typeof drafting;
  embeddings: typeof embeddings;
  estateCommunity: typeof estateCommunity;
  feedback: typeof feedback;
  founderMetrics: typeof founderMetrics;
  founderNotifications: typeof founderNotifications;
  http: typeof http;
  impersonation: typeof impersonation;
  indexer: typeof indexer;
  legalRepo: typeof legalRepo;
  migrations: typeof migrations;
  moneyUtils: typeof moneyUtils;
  myFunctions: typeof myFunctions;
  payments: typeof payments;
  paystack: typeof paystack;
  portalSecurity: typeof portalSecurity;
  portals: typeof portals;
  proactive: typeof proactive;
  pushNotifications: typeof pushNotifications;
  pushNotificationsNode: typeof pushNotificationsNode;
  retainerBilling: typeof retainerBilling;
  salesInquiries: typeof salesInquiries;
  securityHelpers: typeof securityHelpers;
  seedLegalRepo: typeof seedLegalRepo;
  seedSentry: typeof seedSentry;
  sentry: typeof sentry;
  sentryWebhook: typeof sentryWebhook;
  tierLimits: typeof tierLimits;
  trustAccount: typeof trustAccount;
  visitorManagement: typeof visitorManagement;
  wallets: typeof wallets;
  webFetch: typeof webFetch;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
