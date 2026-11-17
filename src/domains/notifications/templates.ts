// Scale-up India — Phase 15: Safe Notification & Email Templates
// Path: src/domains/notifications/templates.ts

/**
 * Escapes unsafe characters in user-controlled strings to prevent HTML injection and XSS
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validates and sanitizes destination URLs to prevent javascript: or malformed redirects
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return "/dashboard";
  const trimmed = url.trim();
  // Safe relative paths starting with /
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }
  // Safe http/https absolute URLs
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    // Invalid URL fallback
  }
  return "/dashboard";
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateParams {
  title?: string;
  body?: string;
  actionUrl?: string;
  actionText?: string;
  recipientName?: string;
  [key: string]: any;
}

/**
 * Renders a secure, brand-compliant email with HTML escaping and progressive confidentiality
 */
export function renderEmailTemplate(
  templateKey: string,
  params: TemplateParams
): RenderedEmail {
  const safeName = escapeHtml(params.recipientName || "Member");
  const safeTitle = escapeHtml(params.title || "Notification from Scale-up India");
  const safeBody = escapeHtml(params.body || "You have a new update in your Scale-up India workspace.");
  const safeActionUrl = sanitizeUrl(params.actionUrl);
  const safeActionText = escapeHtml(params.actionText || "View in Deal Room");

  let subject = "Scale-up India Notification";
  switch (templateKey) {
    case "TRANSACTION_INITIATED":
    case "OPEN_DEAL_ROOM":
    case "TRANSACTION":
      subject = "Action Required: Transaction Deal Room Initialized";
      break;
    case "TRANSACTION_CLOSED":
    case "CLOSING":
      subject = "Notice: Transaction Authoritatively Closed";
      break;
    case "PAYMENT_CONFIRMED":
    case "PAYMENT":
      subject = "Escrow Update: Earnest Deposit Confirmed";
      break;
    case "DUE_DILIGENCE_REQUESTED":
    case "DILIGENCE":
      subject = "Action Required: Due Diligence Information Requested";
      break;
    case "SECURITY_ALERT":
    case "SECURITY":
      subject = "Security Notice: Account Alert";
      break;
    case "MOU_ACCEPTED":
      subject = "Deal Workspace Update: MOU Formally Accepted";
      break;
    case "NDA_EXECUTED":
      subject = "Deal Workspace Update: Bilateral NDA Executed";
      break;
    default:
      subject = safeTitle;
      break;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F9FC; margin: 0; padding: 20px; color: #101828; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #D9E2EC; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background-color: #0B1F3A; padding: 24px 32px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .content { padding: 32px; }
    .content h2 { margin-top: 0; color: #0B1F3A; font-size: 18px; }
    .content p { font-size: 15px; line-height: 1.6; color: #344054; margin: 16px 0; }
    .button-wrap { margin: 28px 0; }
    .button { display: inline-block; background-color: #1557A6; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { padding: 20px 32px; background-color: #F7F9FC; border-top: 1px solid #D9E2EC; font-size: 12px; color: #667085; line-height: 1.5; }
    .disclaimer { font-size: 11px; color: #98A2B3; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SCALE-UP INDIA</h1>
    </div>
    <div class="content">
      <h2>${safeTitle}</h2>
      <p>Dear ${safeName},</p>
      <p>${safeBody}</p>
      <div class="button-wrap">
        <a href="${safeActionUrl}" class="button" target="_blank" rel="noopener noreferrer">${safeActionText}</a>
      </div>
      <p style="font-size: 13px; color: #64748b;">For your security, all sensitive business details, statutory identifiers, and financial dossiers remain strictly confidential and are viewable only within the authenticated portal.</p>
    </div>
    <div class="footer">
      <div>Scale-up India Confidential Transaction Platform &bull; Automated System Notice</div>
      <div class="disclaimer">
        CONFIDENTIALITY NOTICE: This transmission is intended solely for the designated recipient. It may contain confidential and privileged transaction information. If you are not the intended recipient, any disclosure, copying, or distribution is strictly prohibited.
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `SCALE-UP INDIA NOTIFICATION
=================================================
${subject}

Dear ${params.recipientName || "Member"},

${params.body || "You have a new update in your Scale-up India workspace."}

Action Link: ${safeActionUrl}

-------------------------------------------------
CONFIDENTIALITY NOTICE:
For your security, all sensitive business details, statutory identifiers, and financial dossiers remain strictly confidential and are viewable only within the authenticated portal.
`;

  return { subject, html, text };
}
