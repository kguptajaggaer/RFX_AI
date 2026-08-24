import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: { full_name?: string } = await request.json();
  const fullName = body.full_name?.trim();

  if (fullName === undefined) {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { error } = await serviceClient
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
