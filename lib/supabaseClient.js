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

  return {
    from: () => builder,
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null })
    }
  };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseClientConfig = Boolean(supabaseUrl && supabaseKey);
export const supabase = hasSupabaseClientConfig ? createClient(supabaseUrl, supabaseKey) : createMockSupabaseClient();
