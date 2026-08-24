import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceClient = createServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, full_name, email, role, tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: tenant } = await serviceClient
    .from("tenants")
    .select("name, slug, inbound_email_domain")
    .eq("id", profile.tenant_id)
    .single();

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your profile and workspace configuration.
        </p>
      </div>

      <SettingsForm
        profile={{
          id: profile.id,
          full_name: profile.full_name ?? null,
          email: profile.email,
          role: profile.role,
        }}
        tenant={tenant ?? null}
      />
    </div>
  );
}
