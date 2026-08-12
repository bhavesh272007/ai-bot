import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Per-request client that forwards the recruiter's JWT so auth.uid()
// resolves correctly in RLS policies. Use this for any authenticated
// .from(...) query inside an API route — the plain `supabase` export
// above never carries a user session server-side, so RLS policies that
// check auth.uid() would otherwise see it as null.
export function supabaseAsUser(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}