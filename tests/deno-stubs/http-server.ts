/**
 * Local stand-in for `https://deno.land/std@0.168.0/http/server.ts`.
 *
 * Sandboxed CI has no egress to deno.land, so `deno check` cannot download the
 * real module. This file declares the surface the edge function actually uses,
 * which lets the function be type-checked offline. It is NOT used at runtime:
 * the function imports the hosted URL on Supabase.
 */
export declare function serve(handler: (request: Request) => Response | Promise<Response>): void;
