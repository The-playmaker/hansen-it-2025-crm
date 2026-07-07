import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeAdminUser } from "@/lib/auth/roles";

export async function getCurrentUser() {
  const supabase = createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user || null;

  if (userError || !user) {
    return { user: null, profile: null, admin: null, error: userError || null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("id,email,name,role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    profile: profile || null,
    admin: safeAdminUser(user, profile),
    error: profileError || null
  };
}
