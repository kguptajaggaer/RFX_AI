import { redirect } from "next/navigation";

// Root route — hand off to the dashboard events list.
// The real page lives at app/(dashboard)/events/page.tsx,
// wrapped by the sidebar layout.
export default function RootPage() {
  redirect("/events");
}
