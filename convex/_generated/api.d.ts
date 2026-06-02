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
import type * as brainIngestion from "../brainIngestion.js";
import type * as communications from "../communications.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as debug_env from "../debug_env.js";
import type * as drafting from "../drafting.js";
import type * as embeddings from "../embeddings.js";
import type * as feedback from "../feedback.js";
import type * as founderMetrics from "../founderMetrics.js";
import type * as http from "../http.js";
import type * as indexer from "../indexer.js";
import type * as legalRepo from "../legalRepo.js";
import type * as lib_withAuth from "../lib/withAuth.js";
import type * as migrations from "../migrations.js";
import type * as myFunctions from "../myFunctions.js";
import type * as productPermissions from "../productPermissions.js";
import type * as seedLegalRepo from "../seedLegalRepo.js";
import type * as seedSentry from "../seedSentry.js";
import type * as sentry from "../sentry.js";
import type * as sentryWebhook from "../sentryWebhook.js";
import type * as test from "../test.js";

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
  brainIngestion: typeof brainIngestion;
  communications: typeof communications;
  crons: typeof crons;
  debug: typeof debug;
  debug_env: typeof debug_env;
  drafting: typeof drafting;
  embeddings: typeof embeddings;
  feedback: typeof feedback;
  founderMetrics: typeof founderMetrics;
  http: typeof http;
  indexer: typeof indexer;
  legalRepo: typeof legalRepo;
  "lib/withAuth": typeof lib_withAuth;
  migrations: typeof migrations;
  myFunctions: typeof myFunctions;
  productPermissions: typeof productPermissions;
  seedLegalRepo: typeof seedLegalRepo;
  seedSentry: typeof seedSentry;
  sentry: typeof sentry;
  sentryWebhook: typeof sentryWebhook;
  test: typeof test;
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
