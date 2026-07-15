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
    storage: {
      from: () => ({
        upload: async () => response,
        createSignedUploadUrl: async () => singleResponse,
        remove: async () => response
      })
    }
  };
}

function readAdminEnv() {
  return {
    url: process.env.SUPABASE_URL || "",
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

/** Snapshot at import time — fine for request handlers; env is set before process start. */
export const hasSupabaseAdminConfig = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Resolve the admin client only when first used (API/runtime).
 * Never throw at module import — Next sets NODE_ENV=production during `next build`,
 * and CI must succeed with placeholder or missing env.
 */
function resolveClient() {
  const { url, key } = readAdminEnv();

  if (url && key) {
    return createClient(url, key, { auth: { persistSession: false } });
  }

  // Fail closed only when the client is actually used in production.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Supabase er ikke konfigurert. Sjekk SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY i Vercel."
    );
  }

  console.warn("[supabase] Kjører med mock-klient. Kun for lokal utvikling.");
  return createMockSupabaseClient();
}

let cachedClient;

function getClient() {
  if (!cachedClient) cachedClient = resolveClient();
  return cachedClient;
}

/** Lazy proxy: throws in production only when the client is actually used. */
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getClient();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);
