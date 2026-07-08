import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export async function logAdminAudit(actor, action, { entityType, entityId, metadata } = {}) {
  if (!hasSupabaseAdminConfig || !action) return;

  const payload = {
    actor_user_id: actor?.id || null,
    actor_email: actor?.email || null,
    action,
    entity_type: entityType || null,
    entity_id: entityId ? String(entityId) : null,
    metadata: metadata || null
  };

  const { error } = await supabaseAdmin.from("admin_audit_log").insert(payload);
  if (error) console.error("admin audit log insert failed:", { action, message: error.message });
}
