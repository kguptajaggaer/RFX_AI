import { createServiceClient } from "@/lib/supabase/server";

type ActorType = "buyer" | "approver" | "system" | "vendor";

interface AuditEntry {
  tenant_id: string;
  event_id?: string;
  submission_id?: string;
  actor_id?: string;
  actor_type: ActorType;
  actor_label?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  old_value?: unknown;
  new_value?: unknown;
  metadata?: unknown;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: entry.tenant_id,
    event_id: entry.event_id ?? null,
    submission_id: entry.submission_id ?? null,
    actor_id: entry.actor_id ?? null,
    actor_type: entry.actor_type,
    actor_label: entry.actor_label ?? null,
    action: entry.action,
    entity_type: entry.entity_type ?? null,
    entity_id: entry.entity_id ?? null,
    old_value: (entry.old_value ?? null) as import("@/types/database").Json,
    new_value: (entry.new_value ?? null) as import("@/types/database").Json,
    metadata: (entry.metadata ?? null) as import("@/types/database").Json,
  });

  if (error) {
    // Audit failures should not crash the main flow — log to console
    console.error("[audit] Failed to write log entry:", error.message, entry);
  }
}
