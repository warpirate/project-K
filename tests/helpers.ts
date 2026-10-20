import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service-role client: bypasses RLS. Use only for test setup, never to assert app behaviour. */
export const admin = createClient(url, serviceKey, noSession);

/** Throws on a Supabase error, otherwise returns data. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Creates a confirmed auth user and returns a client signed in as that user. */
export async function newUserClient(): Promise<{ client: SupabaseClient; userId: string }> {
  const email = `u-${randomUUID()}@test.local`;
  const password = "test-password-123";
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = createClient(url, anonKey, noSession);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, userId: created.data.user.id };
}
