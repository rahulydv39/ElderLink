/**
 * Reusable email templates for ElderLink notifications.
 *
 * PRIVACY & COMPLIANCE RULES:
 * 1. Contact emails are optional and unverified in our phone-first authentication model.
 * 2. Notification emails must contain ONLY generic, privacy-safe information.
 * 3. NEVER include:
 *    - Patient / elder names
 *    - Medication names, strengths, or dosages
 *    - Diagnoses, symptoms, or medical conditions
 *    - Allergies or clinical history
 *    - Doctor names, clinic locations, or consultation reasons
 *    - Cryptographic invitation codes or access tokens
 * 4. All dynamic variables embedded into HTML must be properly sanitized and escaped.
 */

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

/**
 * Sanitizes untrusted strings to prevent HTML injection in email clients.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Resolves the application base URL from environment or defaults.
 */
function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}

/**
 * Renders the shared, responsive ElderLink email layout with healthcare branding.
 */
function renderBaseLayout({
  title,
  preheader,
  messageHtml,
  ctaText,
  ctaUrl,
}: {
  title: string
  preheader: string
  messageHtml: string
  ctaText: string
  ctaUrl: string
}): string {
  const safeTitle = escapeHtml(title)
  const safePreheader = escapeHtml(preheader)
  const safeCtaText = escapeHtml(ctaText)
  const safeCtaUrl = escapeHtml(ctaUrl)
  const currentYear = 2026

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      color: #334155;
    }
    table {
      border-collapse: separate;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 16px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #0d9488;
      background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%);
      padding: 32px 32px 28px 32px;
      text-align: left;
    }
    .brand-pill {
      display: inline-block;
      background-color: rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 600;
      color: #ffffff;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .brand-title {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 36px 32px 28px 32px;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
      line-height: 1.4;
    }
    .body-text {
      font-size: 14px;
      line-height: 1.65;
      color: #475569;
      margin-bottom: 24px;
    }
    .cta-container {
      margin: 32px 0 16px 0;
      text-align: left;
    }
    .cta-button {
      display: inline-block;
      background-color: #0d9488;
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 10px;
      text-align: center;
      mso-padding-alt: 0;
    }
    .privacy-notice {
      background-color: #f1f5f9;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 12px;
      line-height: 1.5;
      color: #64748b;
      margin-top: 24px;
      border-left: 3px solid #0d9488;
    }
    .footer {
      padding: 24px 32px;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: left;
      font-size: 11px;
      line-height: 1.6;
      color: #94a3b8;
    }
    .footer a {
      color: #0d9488;
      text-decoration: underline;
    }
    @media only screen and (max-width: 600px) {
      .wrapper { padding: 16px 8px !important; }
      .container { width: 100% !important; border-radius: 12px !important; }
      .header { padding: 24px 20px !important; }
      .content { padding: 24px 20px !important; }
      .footer { padding: 20px 20px !important; }
      .cta-button { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#f8fafc;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${safePreheader}
  </div>
  <table role="presentation" class="wrapper" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0">
          <!-- Header -->
          <tr>
            <td class="header">
              <div class="brand-pill">Healthcare Portal</div>
              <h1 class="brand-title">ElderLink</h1>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td class="content">
              <h2 class="title">${safeTitle}</h2>
              <div class="body-text">
                ${messageHtml}
              </div>
              <div class="cta-container">
                <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" class="cta-button">
                  ${safeCtaText} &rarr;
                </a>
              </div>
              <div class="privacy-notice">
                <strong>Privacy &amp; Security Note:</strong> To safeguard patient privacy, medical details, medication names, and care recipient names are never transmitted over unencrypted email. Please sign in to your verified account to review full healthcare records.
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="footer">
              <p style="margin: 0 0 6px 0;">
                <strong>ElderLink</strong> &bull; Collaborative Elderly Healthcare &amp; Medication Management
              </p>
              <p style="margin: 0 0 6px 0;">
                You received this notification because this email address is registered as an optional contact for an active ElderLink account or care circle.
              </p>
              <p style="margin: 0;">
                &copy; ${currentYear} ElderLink. All rights reserved. Secure patient portal.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Formats a plain-text email with ElderLink branding and privacy guidelines.
 */
function renderPlainText({
  title,
  messageText,
  ctaText,
  ctaUrl,
}: {
  title: string
  messageText: string
  ctaText: string
  ctaUrl: string
}): string {
  return `ELDERLINK HEALTHCARE PORTAL
------------------------------------------------------------
${title.toUpperCase()}
------------------------------------------------------------

${messageText}

>> ${ctaText}:
${ctaUrl}

------------------------------------------------------------
PRIVACY & SECURITY NOTICE:
To safeguard patient confidentiality, sensitive medical details,
prescriptions, and care recipient names are never transmitted over
email. Please log in to your verified ElderLink portal to access
full records.

© 2026 ElderLink. Collaborative Elderly Healthcare Management.
`
}

/**
 * 1. Medication Reminder Template (Safe & Generic)
 */
export function getMedicationReminderTemplate(): EmailTemplate {
  const appUrl = getAppBaseUrl()
  const title = 'Scheduled Medication Dose Reminder'
  const preheader = 'A scheduled medication dose is due in your ElderLink care circle.'
  const messageHtml = `
    <p>A scheduled medication dose is due in your ElderLink care circle.</p>
    <p>For patient confidentiality and clinical safety, dosage amounts and prescription names are securely managed within your care portal.</p>
    <p>Please sign in to your ElderLink dashboard using your mobile number to review the current schedule and log administration.</p>
  `
  const messageText = `A scheduled medication dose is due in your ElderLink care circle.

For patient confidentiality and clinical safety, dosage amounts and prescription names are securely managed within your care portal.

Please sign in to your ElderLink dashboard using your mobile number to review the current schedule and log administration.`

  return {
    subject: 'ElderLink Notification: Scheduled Medication Dose',
    html: renderBaseLayout({
      title,
      preheader,
      messageHtml,
      ctaText: 'Sign In to Review Dose',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: renderPlainText({
      title,
      messageText,
      ctaText: 'Sign In to Review Dose',
      ctaUrl: `${appUrl}/dashboard`,
    }),
  }
}

/**
 * 2. Missed Medication Reminder Template (Safe & Generic)
 */
export function getMissedDoseTemplate(): EmailTemplate {
  const appUrl = getAppBaseUrl()
  const title = 'Pending Medication Dose Alert'
  const preheader = 'A scheduled medication dose has not been logged in ElderLink.'
  const messageHtml = `
    <p>A scheduled medication dose has passed its scheduled window without being recorded in your ElderLink care circle.</p>
    <p>Consistent adherence tracking helps your care circle and healthcare providers maintain safe and accurate treatment histories.</p>
    <p>Please sign in to verify whether this dose was administered and update the adherence log accordingly.</p>
  `
  const messageText = `A scheduled medication dose has passed its scheduled window without being recorded in your ElderLink care circle.

Consistent adherence tracking helps your care circle and healthcare providers maintain safe and accurate treatment histories.

Please sign in to verify whether this dose was administered and update the adherence log accordingly.`

  return {
    subject: 'ElderLink Alert: Pending Medication Check',
    html: renderBaseLayout({
      title,
      preheader,
      messageHtml,
      ctaText: 'Check Adherence Log',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: renderPlainText({
      title,
      messageText,
      ctaText: 'Check Adherence Log',
      ctaUrl: `${appUrl}/dashboard`,
    }),
  }
}

/**
 * 3. Upcoming Appointment Reminder Template (Safe & Generic)
 */
export function getAppointmentReminderTemplate(): EmailTemplate {
  const appUrl = getAppBaseUrl()
  const title = 'Upcoming Clinical Consultation Reminder'
  const preheader = 'A clinical consultation is scheduled in your ElderLink care circle.'
  const messageHtml = `
    <p>A medical visit or clinical consultation is scheduled in your ElderLink care circle.</p>
    <p>Caregiver notes, arrival preparation, and scheduling details are securely synchronized across authorized family members and caretakers.</p>
    <p>Please sign in to your ElderLink account to review visit instructions and directions.</p>
  `
  const messageText = `A medical visit or clinical consultation is scheduled in your ElderLink care circle.

Caregiver notes, arrival preparation, and scheduling details are securely synchronized across authorized family members and caretakers.

Please sign in to your ElderLink account to review visit instructions and directions.`

  return {
    subject: 'ElderLink Reminder: Upcoming Clinical Consultation',
    html: renderBaseLayout({
      title,
      preheader,
      messageHtml,
      ctaText: 'View Consultation Details',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: renderPlainText({
      title,
      messageText,
      ctaText: 'View Consultation Details',
      ctaUrl: `${appUrl}/dashboard`,
    }),
  }
}

/**
 * 4. Appointment Update Template (Safe & Generic)
 */
export function getAppointmentUpdateTemplate(): EmailTemplate {
  const appUrl = getAppBaseUrl()
  const title = 'Clinical Consultation Schedule Updated'
  const preheader = 'A medical consultation has been updated in your care circle.'
  const messageHtml = `
    <p>An appointment or consultation detail in your ElderLink care circle has been adjusted by a care circle member.</p>
    <p>Updates to visit timings, notes, or consultation status have been reflected in your shared care circle calendar.</p>
    <p>Please sign in to review the updated appointment schedule.</p>
  `
  const messageText = `An appointment or consultation detail in your ElderLink care circle has been adjusted by a care circle member.

Updates to visit timings, notes, or consultation status have been reflected in your shared care circle calendar.

Please sign in to review the updated appointment schedule.`

  return {
    subject: 'ElderLink Update: Clinical Consultation Adjusted',
    html: renderBaseLayout({
      title,
      preheader,
      messageHtml,
      ctaText: 'Review Updated Schedule',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: renderPlainText({
      title,
      messageText,
      ctaText: 'Review Updated Schedule',
      ctaUrl: `${appUrl}/dashboard`,
    }),
  }
}

/**
 * 5. Care Circle Invitation Notification Template (Safe & Generic)
 */
export function getCareCircleInvitationTemplate(): EmailTemplate {
  const appUrl = getAppBaseUrl()
  const title = 'Care Circle Membership Invitation'
  const preheader = 'You have been invited to join an ElderLink Family Care Circle.'
  const messageHtml = `
    <p>You have been invited to join a collaborative ElderLink Family Care Circle as an authorized caregiver.</p>
    <p>To preserve patient privacy and security, care circle access requires entering your one-time invitation code provided directly by the circle administrator.</p>
    <p>Please sign in to ElderLink with your mobile number to redeem your code and access shared regimens.</p>
  `
  const messageText = `You have been invited to join a collaborative ElderLink Family Care Circle as an authorized caregiver.

To preserve patient privacy and security, care circle access requires entering your one-time invitation code provided directly by the circle administrator.

Please sign in to ElderLink with your mobile number to redeem your code and access shared regimens.`

  return {
    subject: 'ElderLink: Family Care Circle Invitation',
    html: renderBaseLayout({
      title,
      preheader,
      messageHtml,
      ctaText: 'Access Care Circle Portal',
      ctaUrl: `${appUrl}/care-circle/join`,
    }),
    text: renderPlainText({
      title,
      messageText,
      ctaText: 'Access Care Circle Portal',
      ctaUrl: `${appUrl}/care-circle/join`,
    }),
  }
}

/**
 * 6. General ElderLink Notification Template (Safe & Generic)
 */
export function getGenericNotificationTemplate(): EmailTemplate {
  const appUrl = getAppBaseUrl()
  const title = 'New Health Portal Notification'
  const preheader = 'You have a new notification in your ElderLink care circle.'
  const messageHtml = `
    <p>You have a new notification or health record update in your ElderLink care circle.</p>
    <p>Please sign in to your ElderLink account using your registered mobile number to review recent care circle updates and caregiver notes.</p>
  `
  const messageText = `You have a new notification or health record update in your ElderLink care circle.

Please sign in to your ElderLink account using your registered mobile number to review recent care circle updates and caregiver notes.`

  return {
    subject: 'ElderLink Health Portal Notification',
    html: renderBaseLayout({
      title,
      preheader,
      messageHtml,
      ctaText: 'Open ElderLink Dashboard',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: renderPlainText({
      title,
      messageText,
      ctaText: 'Open ElderLink Dashboard',
      ctaUrl: `${appUrl}/dashboard`,
    }),
  }
}
