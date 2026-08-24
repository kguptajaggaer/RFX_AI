import { randomUUID } from "crypto";

const INBOUND_DOMAIN =
  process.env.INBOUND_EMAIL_DOMAIN ?? "inbound.rfxai.com";

export function generateInviteToken(): string {
  return randomUUID();
}

export function buildReplyEmail(inviteToken: string): string {
  return `rfx-${inviteToken}@${INBOUND_DOMAIN}`;
}

export function buildPortalUrl(inviteToken: string): string {
  // Priority: explicit env var → Vercel's auto-injected production URL → localhost fallback
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  return `${base}/vendor/${inviteToken}`;
}

/**
 * Parse the invite token from an inbound reply-to address.
 * Returns null if the address doesn't match the expected pattern.
 */
export function extractReplyToken(toAddress: string): string | null {
  // Handles: "rfx-<uuid>@domain" and variations with display names
  const match = toAddress.match(/rfx-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i);
  return match?.[1] ?? null;
}
