import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const body: { action: "release" | "reject" } = await request.json();
  if (!["release", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Verify the record belongs to this tenant
  const { data: record } = await serviceClient
    .from("email_quarantine")
    .select("id, tenant_id, status")
    .eq("id", id)
    .single();

  if (!record || record.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (record.status !== "quarantined") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  const newStatus =
    body.action === "release" ? "released_as_manual" : "rejected";

  const { error } = await serviceClient
    .from("email_quarantine")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
