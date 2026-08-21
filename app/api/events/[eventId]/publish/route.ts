import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/logger";
import { generateInviteToken, buildReplyEmail, buildPortalUrl } from "@/lib/email-routing/tokens";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface VendorInput {
  email: string;
  companyName: string;
  contactName?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const { vendors, personalMessage }: { vendors: VendorInput[]; personalMessage?: string } =
    await request.json();

  // Validate event is approved
  const { data: event } = await supabase
    .from("rfx_events")
    .select("id, title, event_type, status, submission_deadline, description")
    .eq("id", eventId)
    .single();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.status !== "approved" && event.status !== "draft") {
    return NextResponse.json(
      { error: `Event status is '${event.status}' — cannot publish` },
      { status: 422 }
    );
  }

  const serviceClient = createServiceClient();
  const dispatched: string[] = [];
  const failed: { email: string; reason: string }[] = [];

  for (const vendorInput of vendors) {
    try {
      // Upsert vendor
      const { data: vendor } = await serviceClient
        .from("vendors")
        .upsert(
          {
            tenant_id: profile.tenant_id,
            company_name: vendorInput.companyName,
            primary_email: vendorInput.email.toLowerCase(),
            contact_name: vendorInput.contactName ?? null,
          },
          { onConflict: "tenant_id,primary_email" }
        )
        .select("id")
        .single();

      if (!vendor) throw new Error("Failed to upsert vendor");

      const inviteToken = generateInviteToken();
      const replyEmail = buildReplyEmail(inviteToken);
      const portalUrl = buildPortalUrl(inviteToken);

      // Create invitation
      const { data: invitation } = await serviceClient
        .from("vendor_invitations")
        .insert({
          event_id: eventId,
          tenant_id: profile.tenant_id,
          vendor_id: vendor.id,
          invite_token: inviteToken,
          reply_email: replyEmail,
          portal_url: portalUrl,
          status: "pending",
          personal_message: personalMessage ?? null,
        })
        .select("id")
        .single();

      if (!invitation) throw new Error("Failed to create invitation");

      // Send email via SendGrid
      const msg = {
        to: vendorInput.email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL!,
          name: process.env.SENDGRID_FROM_NAME ?? "RFX AI Platform",
        },
        replyTo: replyEmail,
        subject: `Invitation to bid: ${event.title}`,
        html: buildInvitationEmail({
          eventTitle: event.title,
          eventType: event.event_type,
          description: event.description ?? "",
          deadline: event.submission_deadline,
          portalUrl,
          personalMessage,
          companyName: vendorInput.companyName,
        }),
      };

      const [response] = await sgMail.send(msg);
      const messageId = response.headers?.["x-message-id"] as string | undefined;

      await serviceClient
        .from("vendor_invitations")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          sendgrid_message_id: messageId ?? null,
        })
        .eq("id", invitation.id);

      dispatched.push(vendorInput.email);
    } catch (err) {
      failed.push({
        email: vendorInput.email,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Update event status to published
  await serviceClient
    .from("rfx_events")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", eventId);

  await logAudit({
    tenant_id: profile.tenant_id,
    event_id: eventId,
    actor_id: user.id,
    actor_type: "buyer",
    action: "rfx.published",
    entity_type: "rfx_event",
    entity_id: eventId,
    new_value: { dispatched: dispatched.length, failed: failed.length },
  });

  return NextResponse.json({ data: { dispatched, failed } });
}

function buildInvitationEmail(opts: {
  eventTitle: string;
  eventType: string;
  description: string;
  deadline: string | null;
  portalUrl: string;
  personalMessage?: string;
  companyName: string;
}): string {
  const deadline = opts.deadline
    ? new Date(opts.deadline).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "See event details";

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#1e293b">${opts.eventTitle}</h2>
      <p style="color:#64748b">You have been invited to submit an offer for this ${opts.eventType}.</p>
      ${opts.personalMessage ? `<p style="color:#334155">${opts.personalMessage}</p>` : ""}
      <p><strong>Submission deadline:</strong> ${deadline}</p>
      ${opts.description ? `<p style="color:#475569">${opts.description}</p>` : ""}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#64748b;font-size:14px">
        <strong>Two ways to submit your offer:</strong>
      </p>
      <ol style="color:#475569;font-size:14px">
        <li>Click the button below to access the vendor portal (no registration required)</li>
        <li>Reply directly to this email with your offer in any format (PDF, Word, Excel, etc.)</li>
      </ol>
      <a href="${opts.portalUrl}" style="display:inline-block;margin-top:16px;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
        View &amp; Submit Offer
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px">
        This invitation is addressed to ${opts.companyName}. Do not forward this email — your reply address is unique to your company.
      </p>
    </div>
  `;
}
