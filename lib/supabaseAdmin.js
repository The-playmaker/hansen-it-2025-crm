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
  return { from: () => builder, storage: { from: () => ({ upload: async () => response, createSignedUploadUrl: async () => singleResponse }) } };
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseAdminConfig = Boolean(supabaseUrl && supabaseKey);
export const supabaseAdmin = hasSupabaseAdminConfig ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }) : createMockSupabaseClient();
