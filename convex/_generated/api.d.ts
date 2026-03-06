/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminCohorts from "../adminCohorts.js";
import type * as adminInvitations from "../adminInvitations.js";
import type * as adminUsers from "../adminUsers.js";
import type * as auth from "../auth.js";
import type * as bankDetails from "../bankDetails.js";
import type * as cohortEvents from "../cohortEvents.js";
import type * as cohorts from "../cohorts.js";
import type * as crons from "../crons.js";
import type * as dev_syncFromProd from "../dev/syncFromProd.js";
import type * as founderInvitations from "../founderInvitations.js";
import type * as founderOnboarding from "../founderOnboarding.js";
import type * as founderProfile from "../founderProfile.js";
import type * as founderStartup from "../founderStartup.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as invitations from "../invitations.js";
import type * as invoices from "../invoices.js";
import type * as lib_logging from "../lib/logging.js";
import type * as lib_slugify from "../lib/slugify.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as lib_userCleanup from "../lib/userCleanup.js";
import type * as metrics from "../metrics.js";
import type * as migrations_backfillIsPartnership from "../migrations/backfillIsPartnership.js";
import type * as migrations_updateSupabasePerk from "../migrations/updateSupabasePerk.js";
import type * as milestoneTemplates from "../milestoneTemplates.js";
import type * as milestones from "../milestones.js";
import type * as perks from "../perks.js";
import type * as seed from "../seed.js";
import type * as startups from "../startups.js";
import type * as trackerWebsites from "../trackerWebsites.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminCohorts: typeof adminCohorts;
  adminInvitations: typeof adminInvitations;
  adminUsers: typeof adminUsers;
  auth: typeof auth;
  bankDetails: typeof bankDetails;
  cohortEvents: typeof cohortEvents;
  cohorts: typeof cohorts;
  crons: typeof crons;
  "dev/syncFromProd": typeof dev_syncFromProd;
  founderInvitations: typeof founderInvitations;
  founderOnboarding: typeof founderOnboarding;
  founderProfile: typeof founderProfile;
  founderStartup: typeof founderStartup;
  functions: typeof functions;
  http: typeof http;
  integrations: typeof integrations;
  invitations: typeof invitations;
  invoices: typeof invoices;
  "lib/logging": typeof lib_logging;
  "lib/slugify": typeof lib_slugify;
  "lib/tokens": typeof lib_tokens;
  "lib/userCleanup": typeof lib_userCleanup;
  metrics: typeof metrics;
  "migrations/backfillIsPartnership": typeof migrations_backfillIsPartnership;
  "migrations/updateSupabasePerk": typeof migrations_updateSupabasePerk;
  milestoneTemplates: typeof milestoneTemplates;
  milestones: typeof milestones;
  perks: typeof perks;
  seed: typeof seed;
  startups: typeof startups;
  trackerWebsites: typeof trackerWebsites;
  users: typeof users;
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
