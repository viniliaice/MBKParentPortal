import { supabase } from './supabase';

export interface DeletionResult {
  ok: boolean;
  /** Already user-facing text (the RPC's codes are translated here). */
  error?: string;
}

/**
 * Asks the school to close the account and remove the family's data.
 *
 * There is deliberately no self-service "delete now" call. Accounts are created
 * and administered by the school office, and the school's published privacy
 * policy (§11) describes deletion as a request the school handles — including
 * the academic records it must keep. The database side is
 * `request_account_deletion()` in
 * supabase/migrations/20260923106000_parent_app_functions.sql, which records the
 * request and deletes nothing.
 *
 * Keep this in step with docs/account-deletion.md and app/account.tsx.
 */
export async function requestAccountDeletion(reason?: string): Promise<DeletionResult> {
  const { error } = await supabase.rpc('request_account_deletion', {
    p_reason: reason?.trim() ? reason.trim() : null,
  });
  if (error) return { ok: false, error: describeDeletionError(error.message) };
  return { ok: true };
}

function describeDeletionError(message: string): string {
  if (message.includes('no_profile')) {
    return 'No account is linked to this session. Please sign in again.';
  }
  if (message.includes('not_authenticated')) {
    return 'Please sign in again to send the request.';
  }
  return 'The request could not be sent. Please try again, or contact the school office.';
}
