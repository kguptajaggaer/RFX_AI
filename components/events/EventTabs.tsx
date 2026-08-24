"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview",      suffix: "" },
  { label: "Schema Fields", suffix: "/schema" },
  { label: "Vendors",       suffix: "/vendors" },
  { label: "Submissions",   suffix: "/submissions" },
  { label: "Comparison",    suffix: "/comparison" },
  { label: "Audit",         suffix: "/audit" },
];

export function EventTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-1 border-b border-slate-200">
      {TABS.map((tab) => {
        const href = `/events/${eventId}${tab.suffix}`;
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
