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

// --- Email design: the club's "Her" palette, built with tables and inline styles for email apps ---

const SITE = () => process.env.APP_URL || "https://www.movieclub.co.nz";
const CLUB_STRIP = ["#121310", "#2e1b12", "#5a3a2b", "#8c6e5a", "#7d1712", "#e3be8a", "#afaf98", "#6f8c83", "#2f4a55", "#151d1d"];
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "'Courier New', Courier, monospace";
const SANS = "Helvetica, Arial, sans-serif";

function slate(text: string, color = "#e3be8a"): string {
  return `<p style="margin: 0; font-family: ${MONO}; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: ${color};">${text}</p>`;
}

function strip(colors: string[], width: number, height: number): string {
  const cell = Math.floor(width / colors.length);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse: collapse;"><tr>${colors
    .map((c) => `<td width="${cell}" height="${height}" style="width: ${cell}px; height: ${height}px; background-color: ${c}; font-size: 0; line-height: 0;">&nbsp;</td>`)
    .join("")}</tr></table>`;
}

function button(label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="border-radius: 12px; background-color: #8e1c15;">
    <a href="${SITE()}" style="display: inline-block; padding: 16px 30px; font-family: ${SANS}; font-size: 16px; font-weight: bold; color: #f4e6cc; text-decoration: none; border-radius: 12px;">${label}</a>
  </td></tr></table>`;
}

// The shared frame: dark page, club title with its colour strip, content card and footer
function emailShell(title: string, preheader: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en" xml:lang="en" class="notranslate" translate="no">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #151d1d;">
  <div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #151d1d;">
    <tr><td align="center" style="padding: 24px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 560px; background-color: #1c2626; border: 1px solid #34433f; border-radius: 16px;">
        <tr><td align="center" style="padding: 28px 28px 0;">
          <p style="margin: 0 0 10px; font-family: ${SERIF}; font-style: italic; font-size: 30px; color: #ede3d1;">Movie Club</p>
          ${strip(CLUB_STRIP, 200, 5)}
        </td></tr>
        ${body}
      </table>
      <p style="margin: 16px 0 0; font-family: ${SANS}; font-size: 12px; line-height: 1.6; color: #9a9a84;">You're getting this because you're in Movie Club.<br><a href="${SITE()}" style="color: #9a9a84;">www.movieclub.co.nz</a></p>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", timeZone: "Pacific/Auckland" });
}

function shortTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Pacific/Auckland" });
}

function movieMeta(movie: NonNullable<MovieNight["movie"]>): string {
  const runtime = movie.runtime ? `${Math.floor(Number(movie.runtime) / 60)}h ${Number(movie.runtime) % 60}m` : "";
  return [movie.year, movie.rating, runtime, movie.genre].filter(Boolean).join(" · ");
}

/**
 * Recap email: the gathering photo, Ash's write-up and the pick of the reviews
 */
export function generateNightOverviewEmailHtml(overview: NightOverview, night: MovieNight, reviews: Review[]): string {
  overview = escapeRecord(overview);
  night = escapeNight(night);
  reviews = reviews.map(escapeRecord);
  const movie = night.movie;
  const nightReviews = reviews.filter((r) => r.movieNightId === night.id);
  const avgRating = nightReviews.length > 0 ? (nightReviews.reduce((sum, r) => sum + r.rating, 0) / nightReviews.length).toFixed(1) : null;
  const quotable = nightReviews.filter((r) => r.comment);
  const topReview =
    quotable.find((r) => r.isStarred) ||
    (quotable.length > 0 ? [...quotable].sort((a, b) => b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null);
  const author = (overview.author || "Ash Macintosh").split(" ")[0];
  const host = night.selector.split(" ")[0];

  const photo = overview.imageUrl
    ? `<tr><td style="padding: 22px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f1414;"><tr><td style="padding: 16px 0;">
        <img src="${overview.imageUrl}" alt="The gathering" width="560" style="display: block; width: 100%; max-width: 560px; height: auto; border: 0;">
      </td></tr></table></td></tr>`
    : "";

  const film = movie
    ? `<tr><td style="padding: 22px 32px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        ${movie.posterUrl ? `<td valign="bottom" style="padding-right: 18px;"><img src="${movie.posterUrl}" alt="${movie.title} poster" width="110" style="display: block; width: 110px; height: auto; border-radius: 10px; border: 1px solid #4a5a55;"></td>` : ""}
        <td valign="bottom" style="font-family: ${SANS};">
          <p style="margin: 0; font-family: ${SERIF}; font-style: italic; font-size: 24px; color: #ede3d1;">${movie.title}</p>
          <p style="margin: 6px 0 0; font-size: 14px; color: #afaf98;">${formatNZTDate(night.date)} · ${host}'s pick</p>
          ${avgRating ? `<p style="margin: 8px 0 0; font-size: 15px; font-weight: bold; color: #e3be8a;">&#9733; ${avgRating} club score · ${nightReviews.length} review${nightReviews.length === 1 ? "" : "s"}</p>` : ""}
        </td>
      </tr></table></td></tr>`
    : "";

  const pick = topReview
    ? `<tr><td style="padding: 26px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #2e1b12; border: 1px solid #5a3a2b; border-radius: 12px;"><tr><td style="padding: 20px 22px;">
        ${slate(topReview.isStarred ? "Ash's pick of the reviews" : "Top review")}
        <p style="margin: 12px 0 0; font-family: ${SERIF}; font-style: italic; font-size: 17px; line-height: 1.6; color: #ede3d1;">&ldquo;${topReview.comment}&rdquo;</p>
        <p style="margin: 12px 0 0; font-family: ${SANS}; font-size: 14px; color: #d8cdb8;">${topReview.user.split(" ")[0]} · &#9733; ${topReview.rating}</p>
      </td></tr></table></td></tr>`
    : "";

  const body = `
    <tr><td align="center" style="padding: 22px 28px 0;">${slate(`New recap from ${author}`)}</td></tr>
    ${photo}
    ${film}
    <tr><td style="padding: 26px 32px 0;">
      <h1 style="margin: 0; font-family: ${SERIF}; font-style: italic; font-weight: normal; font-size: 32px; line-height: 1.2; color: #ede3d1;">${overview.title}</h1>
      <p style="margin: 18px 0 0; font-family: ${SERIF}; font-size: 17px; line-height: 1.7; color: #d8cdb8; white-space: pre-wrap;">${overview.content}</p>
    </td></tr>
    ${pick}
    <tr><td align="center" style="padding: 30px 28px 34px;">${button("Read the recap and add your review")}</td></tr>`;

  return emailShell(`Movie Club Recap: ${overview.title}`, `${author}'s recap of ${movie?.title || "the night"}`, body);
}

/**
 * Film chosen email: the poster as the hero, with a ticket for the night
 */
export function generateMovieSelectedEmailHtml(night: MovieNight): string {
  night = escapeNight(night);
  const movie = night.movie!;
  const host = night.selector.split(" ")[0];
  const plot = movie.overview ? (movie.overview.length > 240 ? movie.overview.slice(0, 240) + "&hellip;" : movie.overview) : "";

  const body = `
    <tr><td align="center" style="padding: 24px 28px 0;">
      ${slate("Now showing")}
      <h1 style="margin: 8px 0 0; font-family: ${SERIF}; font-style: italic; font-weight: normal; font-size: 30px; color: #ede3d1;">${host} picked the next film</h1>
    </td></tr>
    ${movie.posterUrl ? `<tr><td align="center" style="padding: 22px 28px 0;"><img src="${movie.posterUrl}" alt="${movie.title} poster" width="300" style="display: block; width: 300px; max-width: 100%; height: auto; border-radius: 12px; border: 1px solid #4a5a55;"></td></tr>` : ""}
    <tr><td align="center" style="padding: 22px 36px 0; font-family: ${SANS};">
      <p style="margin: 0; font-family: ${SERIF}; font-style: italic; font-size: 38px; color: #ede3d1;">${movie.title}</p>
      <p style="margin: 8px 0 0; font-size: 15px; color: #afaf98;">${movieMeta(movie)}</p>
      ${movie.director ? `<p style="margin: 10px 0 0;">${slate(`A film by ${movie.director}`, "#cdc4b0")}</p>` : ""}
      ${plot ? `<p style="margin: 18px 0 0; font-size: 15px; line-height: 1.6; color: #d8cdb8;">${plot}</p>` : ""}
    </td></tr>
    <tr><td style="padding: 26px 36px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #5a3a2b; border-radius: 12px;"><tr>
        <td style="padding: 16px 20px; font-family: ${SANS};">
          ${slate("Admit one")}
          <p style="margin: 6px 0 0; font-size: 17px; font-weight: bold; color: #ede3d1;">${shortDate(night.date)}</p>
          <p style="margin: 2px 0 0; font-size: 15px; color: #afaf98;">${shortTime(night.date)}</p>
        </td>
        <td width="1" style="border-left: 2px dashed #4a5a55; font-size: 0;">&nbsp;</td>
        <td style="padding: 16px 20px; font-family: ${SANS};">
          ${slate("Host", "#afaf98")}
          <p style="margin: 6px 0 0; font-size: 17px; font-weight: bold; color: #ede3d1;">${host}</p>
        </td>
      </tr></table>
    </td></tr>
    <tr><td align="center" style="padding: 30px 28px 34px;">${button("Open Movie Club")}</td></tr>`;

  return emailShell(`The Curtain Rises: ${movie.title}`, `${host} picked ${movie.title} for ${shortDate(night.date)}`, body);
}

/**
 * Test email sent from the admin panel to check delivery
 */
export function generateTestEmailHtml(adminName: string, recipientCount: number): string {
  adminName = escapeHtml(adminName);
  const timestamp = new Date().toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "medium", timeStyle: "short" });
  const body = `
    <tr><td align="center" style="padding: 24px 32px 0;">
      ${slate("Test email")}
      <h1 style="margin: 10px 0 0; font-family: ${SERIF}; font-style: italic; font-weight: normal; font-size: 28px; color: #ede3d1;">Club emails are working</h1>
      <p style="margin: 14px 0 0; font-family: ${SANS}; font-size: 15px; line-height: 1.6; color: #d8cdb8;">${adminName} sent this test on ${timestamp}. It went to ${recipientCount} address${recipientCount === 1 ? "" : "es"} on the club list.</p>
    </td></tr>
    <tr><td align="center" style="padding: 28px 28px 34px;">${button("Open Movie Club")}</td></tr>`;
  return emailShell("Movie Club test email", `Test email from ${adminName}`, body);
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
