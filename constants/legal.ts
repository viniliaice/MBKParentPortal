/**
 * Legal / compliance configuration.
 *
 * Google Play requires a *publicly reachable* privacy-policy URL, and the school
 * publishes the authoritative policy at the URL below: it covers the mobile app
 * and the website, and it is the text the Play listing points at. The in-app
 * screen (app/legal.tsx) shows a short summary and links to it.
 *
 * ACCOUNT_DELETION_URL stays null **on purpose**. Play requires an in-app deletion
 * path plus a web resource only for apps that let users create an account from
 * within the app (see the policy's FAQ: that includes directing the user to a
 * creation flow outside the app). Accounts here are created and administered by
 * the school office and the app only signs in existing accounts, so the
 * requirement is not triggered — the published policy §11 says the same, and the
 * app offers a request to the school instead. If self-service account creation is
 * ever added, this must be revisited: both an in-app path and a public web
 * resource become mandatory.
 *
 * Used by: app/legal.tsx (privacy policy), app/account.tsx (deletion request), and
 * the Play Console listing (see docs/play-store-readiness.md).
 */

/** Public HTTPS URL of the school's published privacy policy. */
export const PRIVACY_POLICY_URL: string | null = 'https://schoolnnnnass.vercel.app/privacy-policy';

/** No web deletion resource is required while accounts are school-created. */
export const ACCOUNT_DELETION_URL: string | null = null;

/** The school's published privacy contact (privacy-policy.md §2 and §12). */
export const SUPPORT_EMAIL: string | null = 'lettersper3@gmail.com';

/** Shown on the legal screen; the school's published policy states the same date. */
export const POLICY_LAST_UPDATED = '2026-09-23';
