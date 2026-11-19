import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { readDb, mutateDb, generateUniqueId, DatabaseSchema } from "./db.ts";
import { isAdminUser } from "./auth.ts";
import { sendEdm, generateThemeLockedEmailHtml } from "./edm.ts";
import { isFirstHost, nextRotationNumber, rotationLengthFrom, rotationNights, rotationNumber, spinStartOptions } from "../src/rotationThemes.ts";
import type { PublicRotationTheme, Theme } from "../src/types.ts";

const MAX_NAME = 80;
const MAX_DESCRIPTION = 500;

// Thrown inside a mutation to send a friendly error back
class ThemeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function fail(res: Response, err: unknown, fallback: string) {
  if (err instanceof ThemeError) return res.status(err.status).json({ error: err.message });
  console.error(fallback, err);
  res.status(500).json({ error: fallback });
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

// Name and explainer from a request body; the explainer may keep its line breaks
function readThemeFields(body: any) {
  const name = cleanText(body?.name, MAX_NAME);
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, MAX_DESCRIPTION) : "";
  if (!name) throw new ThemeError(400, "Give the theme a name.");
  return { name, description };
}

function ensureLists(db: DatabaseSchema) {
  if (!Array.isArray(db.themes)) db.themes = [];
  if (!Array.isArray(db.themeSuggestions)) db.themeSuggestions = [];
  if (!Array.isArray(db.rotationThemes)) db.rotationThemes = [];
  if (db.themeSpin === undefined) db.themeSpin = null;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Every rotation's theme with its current wording, for everyone to see
export function publicRotationThemes(db: DatabaseSchema): PublicRotationTheme[] {
  const list = (db.rotationThemes || []).flatMap((rt) => {
    const theme = (db.themes || []).find((t) => t.id === rt.themeId);
    const start = db.nights.find((n) => n.id === rt.startNightId);
    return theme
      ? [{ startNightId: rt.startNightId, themeId: theme.id, name: theme.name, description: theme.description, lockedAt: rt.lockedAt, number: rt.number ?? 0, length: rt.length ?? rotationLengthFrom(start?.selector || "") }]
      : [];
  });
  // Older records without a number are numbered in date order
  for (const t of list) if (!t.number) t.number = rotationNumber(db.nights, t.startNightId, list.map((x) => ({ ...x, number: x.number || undefined })));
  return list;
}

function available(db: DatabaseSchema, exceptId?: string): Theme[] {
  return (db.themes || []).filter((t) => t.status === "available" && t.id !== exceptId);
}

// A night a theme can start from, described for the admin screens
function describeStart(db: DatabaseSchema, nightId: string) {
  const themes = publicRotationThemes(db);
  const night = db.nights.find((n) => n.id === nightId);
  if (!night) return null;
  return { startNightId: night.id, date: night.date, host: night.selector, number: nextRotationNumber(themes), partial: !isFirstHost(night) };
}

function startOptions(db: DatabaseSchema) {
  return spinStartOptions(db.nights, publicRotationThemes(db)).map((n) => describeStart(db, n.id)!);
}

function adminState(db: DatabaseSchema) {
  const options = startOptions(db);
  return {
    themes: (db.themes || []).filter((t) => !t.hidden),
    suggestions: db.themeSuggestions || [],
    rotationThemes: publicRotationThemes(db),
    spin: db.themeSpin || null,
    // A waiting spin's rotation, otherwise the earliest one that can be spun for
    nextRotation: db.themeSpin ? describeStart(db, db.themeSpin.startNightId) : options[0] || null,
    startOptions: options
  };
}

function pickRandom<T>(items: T[]): T {
  return items[crypto.randomInt(items.length)];
}

// Gives the rotation its theme, takes it off the wheel and tells the club
function lockIn(db: DatabaseSchema, startNightId: string, themeId: string, by: string) {
  const theme = db.themes!.find((t) => t.id === themeId);
  if (!theme) throw new ThemeError(409, "That theme no longer exists. Spin again.");
  const start = db.nights.find((n) => n.id === startNightId);
  if (!start) throw new ThemeError(409, "That night is no longer on the schedule.");
  theme.status = "used";
  db.rotationThemes = db.rotationThemes!.filter((rt) => rt.startNightId !== startNightId);
  db.rotationThemes.push({
    startNightId,
    themeId,
    number: nextRotationNumber(publicRotationThemes(db)),
    // From Ash: all six nights. From partway through: the rest of that rotation.
    length: rotationLengthFrom(start.selector),
    lockedAt: new Date().toISOString(),
    lockedBy: by
  });
  db.themeSpin = null;
  return theme;
}

function emailLockedTheme(startNightId: string) {
  const db = readDb();
  const themes = publicRotationThemes(db);
  const theme = themes.find((t) => t.startNightId === startNightId);
  if (!theme) return;
  const nights = rotationNights(db.nights, startNightId, themes);
  const number = rotationNumber(db.nights, startNightId, themes);
  sendEdm({
    type: "theme",
    subject: `Rotation ${number} theme: ${theme.name}`,
    html: generateThemeLockedEmailHtml(theme, number, nights),
    previewText: `The wheel has spoken. Every pick in Rotation ${number} has to fit "${theme.name}".`
  }).catch((err) => console.error("Couldn't send the theme email:", err));
}

export function registerThemeRoutes(app: Express) {
  // Everyone: each rotation's theme
  app.get("/api/rotation-themes", (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-cache");
      res.json(publicRotationThemes(readDb()));
    } catch (err) {
      fail(res, err, "Couldn't load the rotation themes");
    }
  });

  // Members: suggest a theme for the admins to look at
  app.post("/api/theme-suggestions", async (req, res) => {
    try {
      const fields = readThemeFields(req.body);
      const me = req.authUser!;
      const suggestion = await mutateDb((db) => {
        ensureLists(db);
        const taken = db.themes!.some((t) => !t.hidden && sameName(t.name, fields.name)) || db.themeSuggestions!.some((s) => sameName(s.name, fields.name));
        if (taken) throw new ThemeError(409, `"${fields.name}" is already on the list.`);
        const s = { id: generateUniqueId("sug"), ...fields, suggestedBy: me.name, createdAt: new Date().toISOString() };
        db.themeSuggestions!.push(s);
        return s;
      });
      res.json({ suggestion });
    } catch (err) {
      fail(res, err, "Couldn't send your suggestion");
    }
  });

  // Members: the suggestions they've sent that the admins haven't dealt with yet
  app.get("/api/theme-suggestions/mine", (req, res) => {
    try {
      const me = req.authUser!;
      res.setHeader("Cache-Control", "no-store");
      res.json((readDb().themeSuggestions || []).filter((s) => sameName(s.suggestedBy, me.name)));
    } catch (err) {
      fail(res, err, "Couldn't load your suggestions");
    }
  });

  // --- Admins only (everything under /api/admin/ is checked in auth.ts) ---

  // Small summary for the admin badge: suggestions waiting, and themes left on the wheel
  app.get("/api/admin/themes/summary", (req, res) => {
    try {
      const db = readDb();
      res.setHeader("Cache-Control", "no-store");
      res.json({ suggestions: (db.themeSuggestions || []).length, onWheel: available(db).length, spinWaiting: !!db.themeSpin });
    } catch (err) {
      fail(res, err, "Couldn't load the theme summary");
    }
  });

  app.get("/api/admin/themes", (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(adminState(readDb()));
    } catch (err) {
      fail(res, err, "Couldn't load the themes");
    }
  });

  app.post("/api/admin/themes", async (req, res) => {
    try {
      const fields = readThemeFields(req.body);
      const state = await mutateDb((db) => {
        ensureLists(db);
        if (db.themes!.some((t) => !t.hidden && sameName(t.name, fields.name))) throw new ThemeError(409, `"${fields.name}" is already on the list.`);
        db.themes!.push({ id: generateUniqueId("theme"), ...fields, status: "available", createdAt: new Date().toISOString() });
        return adminState(db);
      });
      res.json(state);
    } catch (err) {
      fail(res, err, "Couldn't add the theme");
    }
  });

  app.put("/api/admin/themes/:id", async (req, res) => {
    try {
      const fields = readThemeFields(req.body);
      const state = await mutateDb((db) => {
        ensureLists(db);
        const theme = db.themes!.find((t) => t.id === req.params.id);
        if (!theme) throw new ThemeError(404, "That theme no longer exists.");
        if (db.themes!.some((t) => t.id !== theme.id && !t.hidden && sameName(t.name, fields.name))) throw new ThemeError(409, `"${fields.name}" is already on the list.`);
        Object.assign(theme, fields);
        return adminState(db);
      });
      res.json(state);
    } catch (err) {
      fail(res, err, "Couldn't save the theme");
    }
  });

  // Unused themes are deleted; used ones are hidden so past rotations keep their theme
  app.delete("/api/admin/themes/:id", async (req, res) => {
    try {
      const state = await mutateDb((db) => {
        ensureLists(db);
        const theme = db.themes!.find((t) => t.id === req.params.id);
        if (!theme) throw new ThemeError(404, "That theme no longer exists.");
        if (db.themeSpin?.themeId === theme.id) throw new ThemeError(409, "The wheel just landed on this one. Lock it in or veto it first.");
        if (db.rotationThemes!.some((rt) => rt.themeId === theme.id)) theme.hidden = true;
        else db.themes = db.themes!.filter((t) => t.id !== theme.id);
        return adminState(db);
      });
      res.json(state);
    } catch (err) {
      fail(res, err, "Couldn't delete the theme");
    }
  });

  // Accept a suggestion as it is, or with the admin's own wording
  app.post("/api/admin/theme-suggestions/:id/accept", async (req, res) => {
    try {
      const state = await mutateDb((db) => {
        ensureLists(db);
        const s = db.themeSuggestions!.find((x) => x.id === req.params.id);
        if (!s) throw new ThemeError(404, "That suggestion has already been dealt with.");
        const fields = readThemeFields({ name: req.body?.name ?? s.name, description: req.body?.description ?? s.description });
        if (db.themes!.some((t) => !t.hidden && sameName(t.name, fields.name))) throw new ThemeError(409, `"${fields.name}" is already on the list.`);
        db.themes!.push({ id: generateUniqueId("theme"), ...fields, status: "available", createdAt: new Date().toISOString(), suggestedBy: s.suggestedBy });
        db.themeSuggestions = db.themeSuggestions!.filter((x) => x.id !== s.id);
        return adminState(db);
      });
      res.json(state);
    } catch (err) {
      fail(res, err, "Couldn't add the suggestion");
    }
  });

  app.delete("/api/admin/theme-suggestions/:id", async (req, res) => {
    try {
      const state = await mutateDb((db) => {
        ensureLists(db);
        db.themeSuggestions = db.themeSuggestions!.filter((x) => x.id !== req.params.id);
        return adminState(db);
      });
      res.json(state);
    } catch (err) {
      fail(res, err, "Couldn't decline the suggestion");
    }
  });

  // Spin the wheel. The server picks the winner so a refresh can't re-roll it.
  // First spin: waits to be locked in or vetoed. Spin after a veto: final, locked in straight away.
  app.post("/api/admin/themes/spin", async (req, res) => {
    try {
      const me = req.authUser!;
      const result = await mutateDb((db) => {
        ensureLists(db);
        const spin = db.themeSpin;
        if (spin && !spin.vetoed) throw new ThemeError(409, "Lock in or veto the last spin first.");

        // The admin chooses where the theme starts from the allowed options (the earliest by default)
        const options = startOptions(db);
        const asked = typeof req.body?.startNightId === "string" ? req.body.startNightId : "";
        if (!spin && asked && !options.some((o) => o.startNightId === asked)) throw new ThemeError(409, "That night can't start a theme. Close the wheel and open it again.");
        const startNightId = spin?.startNightId || asked || options[0]?.startNightId;
        if (!startNightId) throw new ThemeError(409, "There's no upcoming rotation waiting for a theme.");

        const wheel = available(db, spin?.themeId);
        if (!wheel.length) throw new ThemeError(409, "There are no themes left on the wheel. Add some first.");
        const winner = pickRandom(wheel);

        if (spin) {
          lockIn(db, startNightId, winner.id, me.name);
          return { winner, wheel, final: true, startNightId, state: adminState(db) };
        }
        db.themeSpin = { startNightId, themeId: winner.id, vetoed: false, startedAt: new Date().toISOString() };
        return { winner, wheel, final: false, startNightId, state: adminState(db) };
      });
      if (result.final) emailLockedTheme(result.startNightId);
      res.json({
        winner: { id: result.winner.id, name: result.winner.name, description: result.winner.description },
        wheel: result.wheel.map((t) => ({ id: t.id, name: t.name })),
        final: result.final,
        ...result.state
      });
    } catch (err) {
      fail(res, err, "Couldn't spin the wheel");
    }
  });

  app.post("/api/admin/themes/spin/lock", async (req, res) => {
    try {
      const me = req.authUser!;
      const result = await mutateDb((db) => {
        ensureLists(db);
        const spin = db.themeSpin;
        if (!spin || spin.vetoed) throw new ThemeError(409, "There's no spin waiting to be locked in.");
        lockIn(db, spin.startNightId, spin.themeId, me.name);
        return { startNightId: spin.startNightId, state: adminState(db) };
      });
      emailLockedTheme(result.startNightId);
      res.json(result.state);
    } catch (err) {
      fail(res, err, "Couldn't lock in the theme");
    }
  });

  // Undo a spin that's waiting (a test spin, or one pressed by mistake). The veto comes back too.
  app.post("/api/admin/themes/spin/cancel", async (req, res) => {
    try {
      const state = await mutateDb((db) => {
        ensureLists(db);
        if (!db.themeSpin) throw new ThemeError(409, "There's no spin to cancel.");
        db.themeSpin = null;
        return adminState(db);
      });
      res.json(state);
    } catch (err) {
      fail(res, err, "Couldn't cancel the spin");
    }
  });

  // One veto per rotation. The vetoed theme goes back on the wheel for later, unless removed for good.
  app.post("/api/admin/themes/spin/veto", async (req, res) => {
    try {
      const state = await mutateDb((db) => {
        ensureLists(db);
        const spin = db.themeSpin;
        if (!spin) throw new ThemeError(409, "There's no spin to veto.");
        if (spin.vetoed) throw new ThemeError(409, "The veto for this rotation has already been used.");
        if (!available(db, spin.themeId).length) throw new ThemeError(409, "That's the only theme on the wheel, so there's nothing to spin again for. Add another theme first.");
        spin.vetoed = true;
        if (req.body?.removeForGood) db.themes = db.themes!.filter((t) => t.id !== spin.themeId);
        return adminState(db);
      });
      res.json(state);
    } catch (err) {
      fail(res, err, "Couldn't veto the spin");
    }
  });

  // Undo a rotation's theme before that rotation starts (its theme goes back on the wheel)
  app.delete("/api/admin/rotation-themes/:startNightId", async (req, res) => {
    try {
      const state = await mutateDb((db) => {
        ensureLists(db);
        const rt = db.rotationThemes!.find((x) => x.startNightId === req.params.startNightId);
        if (!rt) throw new ThemeError(404, "That rotation has no theme.");
        const start = db.nights.find((n) => n.id === rt.startNightId);
        if (start && new Date(start.date).getTime() < Date.now()) throw new ThemeError(409, "That rotation has already started, so its theme stays.");
        db.rotationThemes = db.rotationThemes!.filter((x) => x !== rt);
        const theme = db.themes!.find((t) => t.id === rt.themeId);
        if (theme && !db.rotationThemes.some((x) => x.themeId === theme.id)) {
          theme.status = "available";
          theme.hidden = false;
        }
        return adminState(db);
      });
      res.json(state);
    } catch (err) {
      fail(res, err, "Couldn't clear the theme");
    }
  });

  // Admins: send a pick back because it doesn't fit the theme. Clears the film and tells the host on the site.
  app.post("/api/nights/:id/send-back", async (req: Request, res: Response) => {
    if (!isAdminUser(req.authUser)) return res.status(403).json({ error: "Only admins can send a pick back." });
    try {
      const night = await mutateDb((db) => {
        const n = db.nights.find((x) => x.id === req.params.id);
        if (!n) throw new ThemeError(404, "Movie night not found");
        if (!n.movie) throw new ThemeError(409, "There's no pick to send back.");
        if (n.status !== "scheduled") throw new ThemeError(409, "That night has already happened, so its pick stays.");
        n.sentBack = { title: n.movie.title, note: cleanText(req.body?.note, 300) || undefined, by: req.authUser!.name, at: new Date().toISOString() };
        n.movie = null;
        n.status = "scheduled";
        return n;
      });
      res.json({ night });
    } catch (err) {
      fail(res, err, "Couldn't send the pick back");
    }
  });
}
