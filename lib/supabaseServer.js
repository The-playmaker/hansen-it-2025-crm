import { createClient } from "@supabase/supabase-js";

function createMockSupabaseClient() {
  const response = { data: [], error: null };
  const singleResponse = { data: null, error: null };
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    single: async () => singleResponse,
    maybeSingle: async () => singleResponse,
    then: (resolve) => Promise.resolve(response).then(resolve)
  };
  return { from: () => builder };
}

export function getSupabaseServer() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : createMockSupabaseClient();
}

export const supabaseServer = getSupabaseServer();
