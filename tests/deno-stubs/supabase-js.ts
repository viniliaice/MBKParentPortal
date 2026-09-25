/**
 * Local stand-in for `https://esm.sh/@supabase/supabase-js@2`.
 *
 * Declares only the query-builder chain the send-notification function uses, so
 * the function can be type-checked without network access. Not used at runtime.
 */
interface PostgrestResult<T> {
  data: T | null;
  error: unknown;
}

interface PostgrestFilterBuilder<T> extends PromiseLike<PostgrestResult<T>> {
  eq(column: string, value: unknown): PostgrestFilterBuilder<T>;
  in(column: string, values: readonly unknown[]): PostgrestFilterBuilder<T>;
  returns<U>(): PromiseLike<PostgrestResult<U>>;
  single<U = T>(): PromiseLike<PostgrestResult<U>>;
}

interface SupabaseClientLike {
  from(table: string): { select(columns?: string): PostgrestFilterBuilder<unknown> };
}

export declare function createClient(url: string, key: string): SupabaseClientLike;
