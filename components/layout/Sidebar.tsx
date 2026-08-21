"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface SidebarProps {
  profile: {
    full_name: string | null;
    email: string;
    role: string;
    tenants?: { name: string; slug: string } | null;
  } | null;
}

const NAV = [
  { label: "Dashboard", href: "/", icon: "⬛" },
  { label: "Events", href: "/events", icon: "📋" },
  { label: "Quarantine", href: "/quarantine", icon: "🔒" },
  { label: "Settings", href: "/settings", icon: "⚙️" },
];

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <span className="text-sm font-bold text-white">R</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">RFX AI</p>
          <p className="text-xs text-slate-400">{profile?.tenants?.name ?? "—"}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
            {profile?.full_name?.[0] ?? profile?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-xs font-medium text-slate-900">
              {profile?.full_name ?? profile?.email}
            </p>
            <p className="text-xs capitalize text-slate-400">{profile?.role}</p>
          </div>
          <button
            onClick={signOut}
            className="text-xs text-slate-400 hover:text-slate-600"
            title="Sign out"
          >
            ↩
          </button>
        </div>
      </div>
    </aside>
  );
}
