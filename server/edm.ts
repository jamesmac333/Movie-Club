import nodemailer from "nodemailer";
import { MovieNight, NightOverview, Review, EdmLog } from "../src/types.ts";
import { readDb, mutateDb, generateUniqueId, stripInlineImages } from "./db.ts";

// --- Making member-entered text safe to place inside email HTML ---

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only web and inline image URLs may be used as image sources
function safeImageUrl(value: string): string {
  return /^(https?:\/\/|data:image\/)/i.test(value.trim()) ? escapeHtml(value.trim()) : "";
}

const URL_FIELDS = new Set(["posterUrl", "imageUrl", "trailerUrl"]);

// Returns a shallow copy with every string field escaped for HTML
function escapeRecord<T extends object>(record: T): T {
  const copy = { ...record } as Record<string, unknown>;
  for (const [key, value] of Object.entries(copy)) {
    if (typeof value === "string") {
      copy[key] = URL_FIELDS.has(key) ? safeImageUrl(value) : escapeHtml(value);
    }
  }
  return copy as T;
}

function escapeNight(night: MovieNight): MovieNight {
  return { ...escapeRecord(night), movie: night.movie ? escapeRecord(night.movie) : null };
}

/**
 * Creates nodemailer transport if SMTP credentials are provided,
 * otherwise provides an elegant local mock transporter that captures EDMs to database logs.
 */
function getTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Strip surrounding quotes and any whitespace from user and password
    const cleanUser = process.env.SMTP_USER.trim().replace(/^["']|["']$/g, "").trim();
    const cleanPass = process.env.SMTP_PASS.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
    const host = process.env.SMTP_HOST.trim().replace(/^["']|["']$/g, "").toLowerCase();

    // If host is Gmail, use nodemailer's built-in Gmail service configuration for optimal TLS/port handling
    if (host === "smtp.gmail.com" || host === "gmail") {
      return nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: cleanUser,
          pass: cleanPass
        }
      });
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST.trim(),
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: cleanUser,
        pass: cleanPass
      }
    });
  }
  return null;
}

export function formatNZTDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-NZ", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

/**
 * Generate luxury cinema styling HTML email for a completed Night Overview (Recap)
 */
export function generateNightOverviewEmailHtml(overview: NightOverview, night: MovieNight, reviews: Review[]): string {
  overview = escapeRecord(overview);
  night = escapeNight(night);
  reviews = reviews.map(escapeRecord);
  const movie = night.movie;
  const nightReviews = reviews.filter((r) => r.movieNightId === night.id);
  const avgRating =
    nightReviews.length > 0
      ? (nightReviews.reduce((sum, r) => sum + r.rating, 0) / nightReviews.length).toFixed(1)
      : null;

  const topReview = 
    nightReviews.find((r) => r.isStarred) ||
    (nightReviews.length > 0
      ? [...nightReviews].sort((a, b) => b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null);

  const formattedDate = formatNZTDate(night.date);

  return `
<!DOCTYPE html>
<html lang="en" xml:lang="en" class="notranslate" translate="no">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Language" content="en">
  <meta name="google" content="notranslate">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${overview.title}</title>
</head>
<body class="notranslate" translate="no" style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; -webkit-text-size-adjust: 100%;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container: Light White Editorial Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.06);">
          
          <!-- Golden Velvet Header Ribbon -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #d97706, #fbbf24, #d97706);"></td>
          </tr>

          <!-- Branding & Category Header -->
          <tr>
            <td style="padding: 28px 32px 18px; background-color: #fafaf9; border-bottom: 1px solid #e7e5e4;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: bold; letter-spacing: 0.22em; color: #b45309; text-transform: uppercase;">
                      ★ MOVIE CLUB ARCHIVES • OFFICIAL SESSION CHRONICLE
                    </span>
                    <h1 style="margin: 10px 0 6px; font-size: 26px; font-weight: 800; font-family: Georgia, serif; font-style: italic; color: #09090b; letter-spacing: -0.02em;">
                      ${overview.title}
                    </h1>
                    <p style="margin: 0; font-size: 13px; color: #52525b;">
                      Curated & Written by <strong style="color: #b45309;">${overview.author || 'Ash Macintosh'}</strong> • Session of ${formattedDate}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Gathering Photo -->
          ${overview.imageUrl ? `
          <tr>
            <td style="padding: 0; background-color: #f4f4f5; text-align: center;">
              <img src="${overview.imageUrl}" alt="${overview.title}" style="width: 100%; max-height: 440px; object-fit: cover; display: block; border-bottom: 1px solid #e7e5e4;" />
            </td>
          </tr>
          ` : ''}

          <!-- Film Badge & Quick Facts -->
          ${movie ? `
          <tr>
            <td style="padding: 22px 32px; background-color: #fdfbf7; border-bottom: 1px solid #f2ede4;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  ${movie.posterUrl ? `
                  <td width="80" valign="top" style="padding-right: 18px;">
                    <img src="${movie.posterUrl}" alt="${movie.title}" width="80" style="border-radius: 12px; border: 1px solid #e5e7eb; display: block; box-shadow: 0 4px 14px rgba(0,0,0,0.08);" />
                  </td>
                  ` : ''}
                  <td valign="middle">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #b45309; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em;">FEATURED FILM</span>
                    <h2 style="margin: 4px 0; font-size: 20px; font-weight: bold; color: #09090b;">${movie.title} <span style="font-size: 14px; color: #71717a; font-weight: normal;">(${movie.year || ''})</span></h2>
                    <p style="margin: 0; font-size: 13px; color: #52525b; line-height: 1.4;">
                      Directed by <strong style="color: #18181b;">${movie.director || 'N/A'}</strong> • Host: <strong style="color: #b45309;">${night.selector}</strong>
                      ${movie.runtime ? ` • ${movie.runtime} min` : ''}
                      ${movie.genre ? ` • ${movie.genre}` : ''}
                    </p>
                    ${avgRating ? `
                    <div style="margin-top: 8px;">
                      <span style="display: inline-block; padding: 3px 10px; background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; font-size: 11px; font-weight: bold; color: #92400e; font-family: 'Courier New', Courier, monospace;">
                        ★ CLUB SCORE: ${avgRating} / 5.0 (${nightReviews.length} reviews)
                      </span>
                    </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Ash's Night Overview Narrative Body (Light White Background with Dark, Ultra-Legible Text) -->
          <tr>
            <td style="padding: 32px 32px; background-color: #ffffff;">
              <h3 style="margin: 0 0 14px; font-size: 12px; font-family: 'Courier New', Courier, monospace; font-weight: bold; letter-spacing: 0.2em; text-transform: uppercase; color: #71717a;">
                THE NIGHT'S CHRONICLE
              </h3>
              <div style="font-size: 16px; line-height: 1.85; color: #18181b; font-family: Georgia, 'Times New Roman', serif; white-space: pre-wrap;">${overview.content}</div>
            </td>
          </tr>

          <!-- Ash's Top Review Highlight (if present) -->
          ${topReview ? `
          <tr>
            <td style="padding: 0 32px 28px; background-color: #ffffff;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 1px dashed #fcd34d; border-radius: 16px; padding: 18px 20px;">
                <tr>
                  <td>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: bold; color: #b45309; text-transform: uppercase; letter-spacing: 0.2em;">
                      ${topReview.isStarred ? "★ ASH'S CURATED BEST REVIEW PICK" : "★ TOP CLUB REVIEW"}
                    </span>
                    <p style="margin: 8px 0; font-size: 15px; font-style: italic; color: #78350f; line-height: 1.55; font-family: Georgia, serif;">
                      "${topReview.comment}"
                    </p>
                    <div style="font-size: 13px; color: #92400e; font-weight: bold;">
                      — ${topReview.user} <span style="color: #78716c; font-weight: normal;">(Score: ${topReview.rating}/5)</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Call to action button -->
          <tr>
            <td align="center" style="padding: 8px 32px 36px; background-color: #ffffff;">
              <a href="${process.env.APP_URL || 'https://movieclub.local'}" style="display: inline-block; background-color: #d97706; color: #ffffff; font-weight: bold; font-size: 13px; text-decoration: none; padding: 13px 30px; border-radius: 12px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 4px 16px rgba(217, 119, 6, 0.35);">
                Enter Movie Club Platform →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 22px 32px; background-color: #fafaf9; border-top: 1px solid #e7e5e4; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #78716c; font-family: 'Courier New', Courier, monospace;">
                Movie Club Fortnightly NZT 19:00 • Sent in English to official club EDM distribution list
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}


/**
 * Generate cinema styling HTML email for newly selected movie
 */
export function generateMovieSelectedEmailHtml(night: MovieNight): string {
  night = escapeNight(night);
  const movie = night.movie!;
  const formattedDate = formatNZTDate(night.date);

  return `
<!DOCTYPE html>
<html lang="en" xml:lang="en" class="notranslate" translate="no">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Language" content="en">
  <meta name="google" content="notranslate">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>The Curtain Rises: ${movie.title}</title>
</head>
<body class="notranslate" translate="no" style="margin: 0; padding: 0; background-color: #080808; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #080808; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #14100e; border: 2px solid #d97706; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 60px rgba(217, 119, 6, 0.25);">
          
          <!-- Golden Light Ribbon -->
          <tr>
            <td style="height: 6px; background: repeating-linear-gradient(90deg, #d97706, #fbbf24 6px, transparent 6px, transparent 12px);"></td>
          </tr>

          <!-- Golden Ticket Announcement Header -->
          <tr>
            <td style="padding: 32px 32px 20px; text-align: center; background-color: #191310; border-bottom: 1px dashed #3f2e21;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: bold; letter-spacing: 0.25em; color: #fbbf24; text-transform: uppercase;">
                ★ THE CURTAIN RISES • NEXT FILM SELECTED (ENGLISH EDITION) ★
              </span>
              <h1 style="margin: 12px 0 6px; font-size: 28px; font-weight: 900; font-family: Georgia, serif; font-style: italic; color: #fafafa; letter-spacing: -0.02em;">
                A Selection is Made!
              </h1>
              <div style="font-size: 13px; color: #d4d4d8;">
                Your host <strong style="color: #fbbf24; font-size: 15px;">${night.selector}</strong> has chosen the feature presentation for <strong style="color: #ffffff;">${formattedDate}</strong> at 19:00 NZT.
              </div>
            </td>
          </tr>

          <!-- Movie Poster & Metadata Card -->
          <tr>
            <td style="padding: 28px 32px; background-color: #14100e;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  ${movie.posterUrl ? `
                  <td width="130" valign="top" style="padding-right: 22px;">
                    <img src="${movie.posterUrl}" alt="${movie.title}" width="130" style="border-radius: 14px; border: 2px solid #3f2e21; display: block; box-shadow: 0 8px 24px rgba(0,0,0,0.8);" />
                  </td>
                  ` : ''}
                  <td valign="top">
                    ${movie.rating ? `
                    <span style="display: inline-block; padding: 2px 8px; background-color: #27272a; border: 1px solid #3f3f46; border-radius: 6px; font-size: 10px; font-weight: bold; color: #a1a1aa; font-family: 'Courier New', Courier, monospace; margin-bottom: 8px;">
                      ${movie.rating}
                    </span>
                    ` : ''}
                    <h2 style="margin: 0 0 6px; font-size: 22px; font-weight: 800; color: #ffffff;">
                      ${movie.title} <span style="font-size: 16px; color: #71717a; font-weight: normal;">(${movie.year || ''})</span>
                    </h2>
                    
                    <p style="margin: 0 0 12px; font-size: 13px; color: #fbbf24;">
                      Director: <strong style="color: #ffffff;">${movie.director || 'N/A'}</strong>
                      ${movie.runtime ? ` • ${movie.runtime} min` : ''}
                      ${movie.genre ? ` • ${movie.genre}` : ''}
                    </p>

                    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #a1a1aa;">
                      ${movie.overview ? (movie.overview.length > 220 ? movie.overview.slice(0, 220) + '...' : movie.overview) : 'No overview available.'}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Schedule Callout Box -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1c1511; border: 1px solid #38271a; border-radius: 16px; padding: 16px 20px;">
                <tr>
                  <td align="center">
                    <span style="font-size: 11px; font-family: 'Courier New', Courier, monospace; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.1em;">
                      Mark Your Calendar
                    </span>
                    <div style="font-size: 16px; font-weight: bold; color: #fbbf24; margin-top: 4px;">
                      ${formattedDate} • 7:00 PM NZT
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Enter Site Button -->
          <tr>
            <td align="center" style="padding: 0 32px 32px;">
              <a href="${process.env.APP_URL || 'https://movieclub.local'}" style="display: inline-block; background-color: #f59e0b; color: #09090b; font-weight: bold; font-size: 13px; text-decoration: none; padding: 12px 28px; border-radius: 12px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);">
                View Details & Trailer on Site →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0b0907; border-top: 1px solid #281f18; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #71717a; font-family: 'Courier New', Courier, monospace;">
                Movie Club Fortnightly NZT 19:00 • Sent to official club EDM distribution list
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate cinema styling HTML email for an Admin EDM Test
 */
export function generateTestEmailHtml(adminName: string, recipientCount: number): string {
  adminName = escapeHtml(adminName);
  const timestamp = new Date().toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" });

  return `
<!DOCTYPE html>
<html lang="en" xml:lang="en" class="notranslate" translate="no">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Language" content="en">
  <meta name="google" content="notranslate">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Movie Club EDM Test Transmission</title>
</head>
<body class="notranslate" translate="no" style="margin: 0; padding: 0; background-color: #080808; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #080808; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #14100e; border: 2px solid #10b981; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(16, 185, 129, 0.2);">
          
          <!-- Green Header Ribbon -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #059669, #34d399, #059669);"></td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px; text-align: center;">
              <div style="display: inline-block; padding: 8px 16px; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 30px; font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: bold; color: #34d399; letter-spacing: 0.2em; text-transform: uppercase;">
                ✓ SYSTEM VERIFICATION TRANSMISSION
              </div>

              <h1 style="margin: 16px 0 8px; font-size: 26px; font-weight: 800; font-family: Georgia, serif; color: #ffffff;">
                EDM Dispatcher is Live & Functional
              </h1>

              <p style="margin: 0 0 20px; font-size: 14px; color: #a1a1aa; line-height: 1.6;">
                This test broadcast was requested by administrator <strong style="color: #fbbf24;">${adminName}</strong> to verify that automated email distributions are operational.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1c1511; border: 1px dashed #38271a; border-radius: 14px; padding: 16px 20px; margin-bottom: 24px; text-align: left;">
                <tr>
                  <td style="font-size: 12px; color: #d4d4d8; line-height: 1.8;">
                    <div>• <strong>Transmission Time:</strong> ${timestamp} (NZT)</div>
                    <div>• <strong>Target Recipients:</strong> ${recipientCount} registered email address(es)</div>
                    <div>• <strong>Delivery Triggers Armed:</strong></div>
                    <div style="padding-left: 16px; color: #a1a1aa;">
                      1. Whenever Ash Macintosh publishes a Night Overview recap<br/>
                      2. Whenever a host locks in the next cycle's movie selection
                    </div>
                  </td>
                </tr>
              </table>

              <a href="${process.env.APP_URL || 'https://movieclub.local'}" style="display: inline-block; background-color: #10b981; color: #022c22; font-weight: bold; font-size: 13px; text-decoration: none; padding: 12px 28px; border-radius: 12px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);">
                Return to Movie Club →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px; background-color: #0b0907; border-top: 1px solid #281f18; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #71717a; font-family: 'Courier New', Courier, monospace;">
                Movie Club Admin EDM Diagnostic Utility
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Dispatch an EDM to all configured recipients
 */
export async function sendEdm({
  type,
  subject,
  html,
  previewText
}: {
  type: "overview" | "movie_selection" | "test";
  subject: string;
  html: string;
  previewText?: string;
}): Promise<EdmLog> {
  const db = readDb();
  const recipients = (db.edmRecipients || []).map((r) => r.email.trim()).filter(Boolean);

  const logId = generateUniqueId("edm");
  const nowIso = new Date().toISOString();

  // If no recipients configured, record simulated log
  if (recipients.length === 0) {
    const log: EdmLog = {
      id: logId,
      type,
      subject,
      sentAt: nowIso,
      recipients: [],
      status: "failed",
      error: "No recipient emails configured in Admin EDM Settings",
      previewText,
      htmlContent: html
    };
    await recordEdmLog(log);
    return log;
  }

  const transporter = getTransporter();
  let status: "sent" | "failed" | "simulated" = "simulated";
  let errorMessage: string | undefined;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Movie Club" <${process.env.SMTP_USER}>`,
        to: recipients.join(", "),
        subject,
        html
      });
      status = "sent";
    } catch (err: any) {
      console.error("Nodemailer SMTP failed:", err);
      status = "failed";
      errorMessage = err.message || "Failed to transmit email via SMTP server";
    }
  } else {
    // Graceful simulation: logs transmission faithfully with full HTML for admin inspection
    status = "simulated";
    console.log(`[EDM Dispatched (${status})]: "${subject}" sent to ${recipients.length} recipients: ${recipients.join(", ")}`);
  }

  const log: EdmLog = {
    id: logId,
    type,
    subject,
    sentAt: nowIso,
    recipients,
    status,
    previewText: previewText || subject,
    htmlContent: html,
    error: errorMessage
  };

  await recordEdmLog(log);
  return log;
}

function sanitizeHtmlForLog(htmlStr?: string): string {
  if (!htmlStr) return "";
  // Replace large inline base64 image URIs in logs to prevent bloating server-db.json
  return stripInlineImages(htmlStr);
}

async function recordEdmLog(log: EdmLog) {
  try {
    const cleanLog: EdmLog = {
      ...log,
      htmlContent: sanitizeHtmlForLog(log.htmlContent)
    };
    await mutateDb((currentDb) => {
      if (!currentDb.edmLogs) currentDb.edmLogs = [];
      // Keep last 50 logs for tidy history
      currentDb.edmLogs.unshift(cleanLog);
      if (currentDb.edmLogs.length > 50) {
        currentDb.edmLogs = currentDb.edmLogs.slice(0, 50);
      }
    });
  } catch (e) {
    console.error("Failed to record EDM log:", e);
  }
}
