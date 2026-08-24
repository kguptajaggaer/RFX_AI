import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";

/** Auto-provision a tenant + profile for brand-new users (first login). */
async function ensureProfile(userId: string, email: string) {
  const service = createServiceClient();

  // Try to get existing profile first
  const { data: existing } = await service
    .from("profiles")
    .select("id, tenant_id, full_name, email, role, tenants(name, slug)")
    .eq("id", userId)
    .single();

  if (existing) return existing;

  // No profile yet — create tenant from email domain
  const domain = email.split("@")[1] ?? "company.com";
  const slug = domain.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const name = domain.split(".")[0];

  // Upsert tenant (slug must be unique — use domain)
  const { data: tenant } = await service
    .from("tenants")
    .upsert({ name, slug, inbound_email_domain: "inbound.rfxai.com" }, { onConflict: "slug" })
    .select("id, name, slug")
    .single();

  if (!tenant) return null;

  // Create profile
  const { data: profile } = await service
    .from("profiles")
    .insert({ id: userId, tenant_id: tenant.id, email, role: "admin" })
    .select("id, tenant_id, full_name, email, role")
    .single();

  if (!profile) return null;

  return { ...profile, tenants: { name: tenant.name, slug: tenant.slug } };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await ensureProfile(user.id, user.email ?? "");

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
