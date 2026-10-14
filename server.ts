import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  readDb, 
  writeDb, 
  mutateDb, 
  generateUniqueId, 
  ensureFutureNights,
  canonicalizeHostName,
  HOST_ROTATION,
  getRotationIndex,
  realignFutureNights
} from "./server/db.ts";
import { fetchMovieMetadata } from "./server/gemini.ts";
import { MovieNight, Review, NightOverview, EdmRecipient, EdmLog } from "./src/types.ts";
import {
  sendEdm,
  generateNightOverviewEmailHtml,
  generateMovieSelectedEmailHtml,
  generateTestEmailHtml,
  formatNZTDate
} from "./server/edm.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large base64 image payloads for the "Blob" image uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // --- API ROUTES ---

  // Auth: Login
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }
    try {
      const db = readDb();
      const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (user.password !== password) {
        return res.status(401).json({ error: "Incorrect password" });
      }
      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Auth: Change password
  app.post("/api/auth/change-password", (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ error: "Missing username or new password" });
    }
    try {
      const db = readDb();
      const userIndex = db.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
      if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
      }
      db.users[userIndex].password = newPassword;
      writeDb(db);
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  // Auth: Admin set password for any user
  app.post("/api/auth/admin-set-password", (req, res) => {
    const { adminUsername, targetUsername, newPassword } = req.body;
    if (!adminUsername || !targetUsername || !newPassword) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const adminLower = adminUsername.toLowerCase();
    if (adminLower !== "james" && adminLower !== "ash") {
      return res.status(403).json({ error: "Unauthorized. Only admins can set passwords." });
    }
    try {
      const db = readDb();
      const userIndex = db.users.findIndex(u => u.username.toLowerCase() === targetUsername.toLowerCase());
      if (userIndex === -1) {
        return res.status(404).json({ error: "Target user not found" });
      }
      db.users[userIndex].password = newPassword;
      writeDb(db);
      res.json({ message: `Password for ${db.users[userIndex].name} reset successfully` });
    } catch (error) {
      res.status(500).json({ error: "Failed to set user password" });
    }
  });

  // Auth: Get user avatar image directly as binary stream
  app.get("/api/users/:username/avatar", (req, res) => {
    try {
      const { username } = req.params;
      const db = readDb();
      const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user || !user.avatarUrl) {
        return res.status(404).send("Avatar not found");
      }

      if (user.avatarUrl.startsWith("data:image/")) {
        const matches = user.avatarUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const imgBuffer = Buffer.from(matches[2], "base64");
          res.setHeader("Content-Type", `image/${mime === "jpg" ? "jpeg" : mime}`);
          res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
          return res.send(imgBuffer);
        }
      }

      if (user.avatarUrl.startsWith("http://") || user.avatarUrl.startsWith("https://") || user.avatarUrl.startsWith("/")) {
        return res.redirect(user.avatarUrl);
      }

      res.status(404).send("Invalid avatar format");
    } catch (err) {
      res.status(500).send("Error serving avatar");
    }
  });

  // Auth: Get users (lightweight, safe for mobile & proxies)
  app.get("/api/users", (req, res) => {
    try {
      const db = readDb();
      const safeUsers = db.users.map(({ password, ...u }) => {
        if (u.avatarUrl && u.avatarUrl.startsWith("data:image/")) {
          return {
            ...u,
            avatarUrl: `/api/users/${encodeURIComponent(u.username)}/avatar`
          };
        }
        return u;
      });
      res.setHeader("Cache-Control", "no-cache");
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to load users" });
    }
  });

  // Auth: Update user avatar (manually loaded, no AI processing - Admin Only)
  app.put("/api/users/:username/avatar", (req, res) => {
    const { username } = req.params;
    const { avatarUrl, requester } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ error: "Missing avatar data" });
    }

    const reqLower = requester?.toLowerCase();
    if (!requester || (reqLower !== "james" && reqLower !== "ash")) {
      return res.status(403).json({ error: "Unauthorized. Only administrators can change profile pictures." });
    }

    try {
      const db = readDb();
      const userIndex = db.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
      if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
      }
      db.users[userIndex].avatarUrl = avatarUrl;
      writeDb(db);
      res.json({ message: "Avatar updated successfully", avatarUrl });
    } catch (error) {
      res.status(500).json({ error: "Failed to update avatar" });
    }
  });

  // 1. Get all movie nights (calendar & landing page)
  app.get("/api/nights", async (req, res) => {
    try {
      const db = readDb();
      const scheduledCount = db.nights.filter((n) => n.status === "scheduled").length;
      if (scheduledCount < 6) {
        await mutateDb((currentDb) => {
          ensureFutureNights(currentDb);
        });
      }
      res.json(db.nights);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movie nights" });
    }
  });

  // 2. Update a movie night's date (Admin only: James or Ash)
  app.put("/api/nights/:id/date", async (req, res) => {
    const { id } = req.params;
    const { date, requester } = req.body;

    const reqLower = requester?.toLowerCase();
    if (!requester || (reqLower !== "james" && reqLower !== "ash")) {
      return res.status(403).json({ error: "Unauthorized. Only James or Ash can edit dates." });
    }

    if (!date) {
      return res.status(400).json({ error: "Missing new date" });
    }

    try {
      const updatedNight = await mutateDb((db) => {
        const nightIndex = db.nights.findIndex((n) => n.id === id);
        if (nightIndex === -1) {
          return null;
        }

        db.nights[nightIndex].date = date;
        return db.nights[nightIndex];
      });

      if (!updatedNight) {
        return res.status(404).json({ error: "Movie night not found" });
      }

      res.json({ message: "Date updated successfully", night: updatedNight });
    } catch (error) {
      res.status(500).json({ error: "Failed to update date" });
    }
  });

  // 2.5. Update a movie night's assigned host/selector (Admin only: James or Ash)
  app.put("/api/nights/:id/selector", async (req, res) => {
    const { id } = req.params;
    const { selector, requester, realignSubsequent } = req.body;

    const reqLower = requester?.toLowerCase();
    if (!requester || (reqLower !== "james" && reqLower !== "ash")) {
      return res.status(403).json({ error: "Unauthorized. Only James or Ash can change assigned session hosts." });
    }

    if (!selector || typeof selector !== "string") {
      return res.status(400).json({ error: "Missing new selector name" });
    }

    const cleanSelector = canonicalizeHostName(selector);

    try {
      const updatedNight = await mutateDb((db) => {
        const nightIndex = db.nights.findIndex((n) => n.id === id);
        if (nightIndex === -1) {
          return null;
        }

        db.nights[nightIndex].selector = cleanSelector;

        // If requested, auto-realign all subsequent scheduled uncompleted sessions
        // to continue the standard cycle: Max > Ash > Madi > Amy > Tom > James
        if (realignSubsequent) {
          db.nights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const targetIndex = db.nights.findIndex((n) => n.id === id);
          if (targetIndex !== -1) {
            let nextRotationIdx = (getRotationIndex(cleanSelector) + 1) % HOST_ROTATION.length;
            for (let i = targetIndex + 1; i < db.nights.length; i++) {
              if (db.nights[i].status === "scheduled" && !db.nights[i].movie) {
                db.nights[i].selector = HOST_ROTATION[nextRotationIdx];
                nextRotationIdx = (nextRotationIdx + 1) % HOST_ROTATION.length;
              }
            }
          }
        }

        return db.nights[nightIndex];
      });

      if (!updatedNight) {
        return res.status(404).json({ error: "Movie night not found" });
      }

      const db = readDb();
      res.json({ 
        message: `Assigned host updated to ${cleanSelector}`, 
        night: updatedNight, 
        nights: db.nights 
      });
    } catch (error) {
      console.error("Failed to update selector:", error);
      res.status(500).json({ error: "Failed to update assigned host" });
    }
  });

  // 2.6. Re-align all future scheduled movie nights to standard order: Max > Ash > Madi > Amy > Tom > James
  app.post("/api/nights/realign-rotation", async (req, res) => {
    const { requester, startingSelector } = req.body;

    const reqLower = requester?.toLowerCase();
    if (!requester || (reqLower !== "james" && reqLower !== "ash")) {
      return res.status(403).json({ error: "Unauthorized. Only James or Ash can re-align session rotations." });
    }

    try {
      await mutateDb((db) => {
        realignFutureNights(db, startingSelector);
      });

      const db = readDb();
      res.json({ 
        message: "Future rotation realigned successfully (Max > Ash > Madi > Amy > Tom > James)", 
        nights: db.nights 
      });
    } catch (error) {
      console.error("Failed to realign rotation:", error);
      res.status(500).json({ error: "Failed to realign rotation" });
    }
  });

  // 3. Select / input movie choice for a night (The selector or admin)
  app.put("/api/nights/:id/movie", async (req, res) => {
    const { id } = req.params;
    const { movieTitle, selector, requester, requesterName } = req.body;

    if (!movieTitle) {
      return res.status(400).json({ error: "Missing movie title" });
    }

    try {
      const dbSnapshot = readDb();
      const night = dbSnapshot.nights.find((n) => n.id === id);
      if (!night) {
        return res.status(404).json({ error: "Movie night not found" });
      }

      // Security check: must be either the assigned selector, or an admin (James/Ash)
      const isSelector = selector && selector.toLowerCase() === requesterName?.toLowerCase();
      const isAdmin = requester?.toLowerCase() === "james" || requester?.toLowerCase() === "ash";

      if (!isSelector && !isAdmin) {
        return res.status(403).json({ 
          error: `Unauthorized. Only the assigned selector (${night.selector}) or an admin can choose the movie.` 
        });
      }

      // Fetch metadata from Gemini SDK
      const metadata = await fetchMovieMetadata(movieTitle, night.selector);

      const updatedNight = await mutateDb((db) => {
        const nightIndex = db.nights.findIndex((n) => n.id === id);
        if (nightIndex === -1) return null;

        db.nights[nightIndex].movie = metadata;
        
        // If date is in the past compared to current time, mark it watched, else scheduled
        const nightDate = new Date(db.nights[nightIndex].date);
        const now = new Date();
        db.nights[nightIndex].status = nightDate < now ? "watched" : "scheduled";

        return db.nights[nightIndex];
      });

      if (!updatedNight) {
        return res.status(404).json({ error: "Movie night not found" });
      }

      // Fire and forget EDM for movie selection: notify club recipients
      sendEdm({
        type: "movie_selection",
        subject: `The Curtain Rises: ${metadata.title} selected by ${night.selector}`,
        html: generateMovieSelectedEmailHtml(updatedNight),
        previewText: `${night.selector} has chosen "${metadata.title}" for Movie Night on ${formatNZTDate(updatedNight.date)}!`
      }).catch((edmErr) => {
        console.error("Async EDM dispatch error on movie selection:", edmErr);
      });

      res.json({ message: "Movie selected and metadata pulled successfully", night: updatedNight });
    } catch (error) {
      console.error("Error choosing movie:", error);
      res.status(500).json({ error: "Failed to pull movie metadata or update selection" });
    }
  });

  // 3.5. Reset a movie night's movie choice (The selector or admin)
  app.post("/api/nights/:id/reset-movie", async (req, res) => {
    const { id } = req.params;
    const { requester, requesterName } = req.body;

    try {
      const updatedNight = await mutateDb((db) => {
        const nightIndex = db.nights.findIndex((n) => n.id === id);
        if (nightIndex === -1) {
          return null;
        }

        const night = db.nights[nightIndex];

        // Security check: must be either the assigned selector, or an admin (James/Ash)
        const isSelector = night.selector && (
          night.selector.toLowerCase() === requesterName?.toLowerCase() ||
          night.selector.toLowerCase() === requester?.toLowerCase()
        );
        const isAdmin = requester?.toLowerCase() === "james" || requester?.toLowerCase() === "ash";

        if (!isSelector && !isAdmin) {
          throw new Error("UNAUTHORIZED");
        }

        db.nights[nightIndex].movie = null;
        db.nights[nightIndex].status = "scheduled"; // revert back to scheduled

        return db.nights[nightIndex];
      });

      if (!updatedNight) {
        return res.status(404).json({ error: "Movie night not found" });
      }

      res.json({ message: "Movie selection reset successfully", night: updatedNight });
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(403).json({ error: "Unauthorized. Only the assigned selector or an admin can reset this choice." });
      }
      console.error("Error resetting movie selection:", error);
      res.status(500).json({ error: "Failed to reset movie selection" });
    }
  });

  // 4. Force status update (mark watched) - helpful for testing & admin
  app.put("/api/nights/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status, requester } = req.body;

    if (requester?.toLowerCase() !== "james" && requester?.toLowerCase() !== "ash") {
      return res.status(403).json({ error: "Only admins can change event status." });
    }

    try {
      const updatedNight = await mutateDb((db) => {
        const index = db.nights.findIndex(n => n.id === id);
        if (index === -1) return null;

        db.nights[index].status = status;
        ensureFutureNights(db);
        return db.nights[index];
      });

      if (!updatedNight) return res.status(404).json({ error: "Not found" });

      res.json(updatedNight);
    } catch (e) {
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // 5. Get all reviews
  app.get("/api/reviews", (req, res) => {
    try {
      const db = readDb();
      res.json(db.reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // 6. Submit a new review (Concurrency-safe via mutateDb)
  app.post("/api/reviews", async (req, res) => {
    const { movieNightId, user, rating, comment } = req.body;

    if (!movieNightId || !user || rating === undefined || rating === null || !comment) {
      return res.status(400).json({ error: "Missing review fields (movieNightId, user, rating, comment)" });
    }

    try {
      const result = await mutateDb(async (db) => {
        const numericRating = Number(rating);
        const nowIso = new Date().toISOString();
        const cleanUser = String(user).trim();

        // Check if an existing review exists from this user for this movie night (upsert safety)
        const existingIndex = db.reviews.findIndex(
          (r) => r.movieNightId === movieNightId && r.user.trim().toLowerCase() === cleanUser.toLowerCase()
        );

        let savedReview: Review;

        if (existingIndex !== -1) {
          // Update the user's review in place
          db.reviews[existingIndex].rating = numericRating;
          db.reviews[existingIndex].comment = String(comment).trim();
          db.reviews[existingIndex].createdAt = nowIso;
          savedReview = db.reviews[existingIndex];
        } else {
          // Create new review with guaranteed unique cryptographic ID
          savedReview = {
            id: generateUniqueId("rev"),
            movieNightId,
            user: cleanUser,
            rating: numericRating,
            comment: String(comment).trim(),
            createdAt: nowIso
          };
          db.reviews.push(savedReview);
        }

        // Auto upgrade movie status to watched when reviewed
        const nightIndex = db.nights.findIndex((n) => n.id === movieNightId);
        if (nightIndex !== -1 && db.nights[nightIndex].status === "scheduled") {
          db.nights[nightIndex].status = "watched";
          ensureFutureNights(db);
        }

        return {
          savedReview,
          reviews: [...db.reviews],
          nights: [...db.nights]
        };
      });

      res.json({
        message: "Review posted successfully",
        review: result.savedReview,
        reviews: result.reviews,
        nights: result.nights
      });
    } catch (error) {
      console.error("Failed to save review:", error);
      res.status(500).json({ error: "Failed to save review" });
    }
  });

  // 7. Edit a review (Author or Admin James/Ash)
  app.put("/api/reviews/:id", async (req, res) => {
    const { id } = req.params;
    const { rating, comment, requester, requesterName } = req.body;

    if (rating === undefined || !comment) {
      return res.status(400).json({ error: "Missing comment or rating" });
    }

    try {
      const result = await mutateDb(async (db) => {
        const index = db.reviews.findIndex((r) => r.id === id);
        if (index === -1) {
          return null;
        }

        const review = db.reviews[index];
        const isAuthor = review.user.trim().toLowerCase() === requesterName?.trim().toLowerCase();
        const isAdmin = requester?.toLowerCase() === "james" || requester?.toLowerCase() === "ash";

        if (!isAuthor && !isAdmin) {
          throw new Error("UNAUTHORIZED");
        }

        db.reviews[index].rating = Number(rating);
        db.reviews[index].comment = String(comment).trim();
        db.reviews[index].createdAt = new Date().toISOString();

        return { review: db.reviews[index], reviews: [...db.reviews] };
      });

      if (!result) {
        return res.status(404).json({ error: "Review not found" });
      }

      res.json({
        message: "Review updated successfully",
        review: result.review,
        reviews: result.reviews
      });
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(403).json({ error: "Unauthorized. You can only edit your own reviews." });
      }
      res.status(500).json({ error: "Failed to edit review" });
    }
  });

  // Auth: Star a review (Ash Only)
  app.put("/api/reviews/:id/star", async (req, res) => {
    const { id } = req.params;
    const { requester } = req.body;

    const reqLower = requester?.toLowerCase();
    if (reqLower !== "ash") {
      return res.status(403).json({ error: "Unauthorized. Only Ash Macintosh can star reviews." });
    }

    try {
      const result = await mutateDb(async (db) => {
        const reviewIndex = db.reviews.findIndex((r) => r.id === id);
        if (reviewIndex === -1) {
          return null;
        }

        const review = db.reviews[reviewIndex];
        const isCurrentlyStarred = review.isStarred || false;

        // Exclusive star per session (movieNightId)
        db.reviews.forEach((r) => {
          if (r.movieNightId === review.movieNightId) {
            r.isStarred = false;
          }
        });

        // Toggle star status
        db.reviews[reviewIndex].isStarred = !isCurrentlyStarred;

        return { review: db.reviews[reviewIndex], reviews: [...db.reviews] };
      });

      if (!result) {
        return res.status(404).json({ error: "Review not found" });
      }

      res.json({
        message: "Review star status updated successfully",
        review: result.review,
        reviews: result.reviews
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update review star status" });
    }
  });

  // 8. Delete a review (Author or Admin James/Ash)
  app.delete("/api/reviews/:id", async (req, res) => {
    const { id } = req.params;
    const { requester, requesterName } = req.body;

    try {
      const result = await mutateDb(async (db) => {
        const index = db.reviews.findIndex((r) => r.id === id);
        if (index === -1) {
          return null;
        }

        const review = db.reviews[index];
        const isAuthor = review.user.trim().toLowerCase() === requesterName?.trim().toLowerCase();
        const isAdmin = requester?.toLowerCase() === "james" || requester?.toLowerCase() === "ash";

        if (!isAuthor && !isAdmin) {
          throw new Error("UNAUTHORIZED");
        }

        db.reviews.splice(index, 1);
        return { success: true, reviews: [...db.reviews] };
      });

      if (!result) {
        return res.status(404).json({ error: "Review not found" });
      }

      res.json({ message: "Review deleted successfully", reviews: result.reviews });
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(403).json({ error: "Unauthorized. You can only delete your own reviews." });
      }
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // Delete a night overview (Admins and Ash Macintosh)
  app.delete("/api/overviews/:id", async (req, res) => {
    const { id } = req.params;
    const { requester } = req.body;

    const reqLower = requester?.toLowerCase();
    if (!requester) {
      return res.status(400).json({ error: "Missing requester username" });
    }

    try {
      const deleted = await mutateDb((db) => {
        const user = db.users.find(u => u.username.toLowerCase() === reqLower);
        const isAuthorized = reqLower === "ash" || reqLower === "james" || user?.isAdmin;

        if (!isAuthorized) {
          throw new Error("UNAUTHORIZED");
        }

        const index = db.overviews.findIndex((ov) => ov.id === id);
        if (index === -1) {
          return false;
        }

        db.overviews.splice(index, 1);
        return true;
      });

      if (!deleted) {
        return res.status(404).json({ error: "Overview not found" });
      }

      res.json({ message: "Overview deleted successfully" });
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(403).json({ error: "Unauthorized. Only Ash Macintosh or Admins can delete overviews." });
      }
      res.status(500).json({ error: "Failed to delete overview" });
    }
  });

  // 9.5. Get overview memory gathering photo directly as binary image stream
  app.get("/api/overviews/:id/image", (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      const ov = (db.overviews || []).find((o) => o.id === id);
      if (!ov || !ov.imageUrl) {
        return res.status(404).send("Image not found");
      }

      if (ov.imageUrl.startsWith("data:image/")) {
        const matches = ov.imageUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const imgBuffer = Buffer.from(matches[2], "base64");
          res.setHeader("Content-Type", `image/${mime === "jpg" ? "jpeg" : mime}`);
          res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
          return res.send(imgBuffer);
        }
      }

      if (ov.imageUrl.startsWith("http://") || ov.imageUrl.startsWith("https://")) {
        return res.redirect(ov.imageUrl);
      }

      res.status(404).send("Invalid image format");
    } catch (err) {
      console.error("Failed to serve overview image:", err);
      res.status(500).send("Error serving image");
    }
  });

  // 9. Get all night overviews (lightweight, safe for mobile & proxies)
  app.get("/api/overviews", (req, res) => {
    try {
      const db = readDb();
      // Transform raw inline data URIs into lightweight /api/overviews/:id/image URLs.
      // This reduces payload from 37.5MB down to ~1.5KB, eliminating Cloud Run 32MB errors,
      // Vercel 4.5MB proxy errors, and mobile browser crashes!
      const safeOverviews = (db.overviews || []).map((ov) => {
        if (ov.imageUrl && ov.imageUrl.startsWith("data:image/")) {
          return {
            ...ov,
            imageUrl: `/api/overviews/${ov.id}/image`
          };
        }
        return ov;
      });
      res.setHeader("Cache-Control", "no-cache");
      res.json(safeOverviews);
    } catch (error) {
      console.error("Failed to fetch overviews:", error);
      res.status(500).json({ error: "Failed to fetch night overviews" });
    }
  });

  // 10. Post a new night overview (Only Ash Macintosh)
  app.post("/api/overviews", async (req, res) => {
    const { movieNightId, title, content, imageUrl, requester } = req.body;

    // Explicit security check: Only Ash can post overviews
    if (requester?.toLowerCase() !== "ash") {
      return res.status(403).json({ error: "Unauthorized. Only Ash Macintosh can write night overviews." });
    }

    if (!movieNightId || !title || !content || !imageUrl) {
      return res.status(400).json({ error: "Missing required overview fields" });
    }

    try {
      const newOverview = await mutateDb((db) => {
        // Check if night exists
        const nightIndex = db.nights.findIndex((n) => n.id === movieNightId);
        if (nightIndex === -1) {
          return null;
        }

        const overviewObj: NightOverview = {
          id: generateUniqueId("ov"),
          movieNightId,
          title,
          content,
          imageUrl, // Stored as base64 or Unsplash url
          author: "Ash Macintosh",
          createdAt: new Date().toISOString()
        };

        // Ensure that there is only one overview per night
        const existingOvIndex = db.overviews.findIndex((ov) => ov.movieNightId === movieNightId);
        if (existingOvIndex !== -1) {
          db.overviews[existingOvIndex] = overviewObj;
        } else {
          db.overviews.push(overviewObj);
        }

        // Mark the movie night as watched
        db.nights[nightIndex].status = "watched";
        ensureFutureNights(db);

        return overviewObj;
      });

      if (!newOverview) {
        return res.status(404).json({ error: "Movie night not found" });
      }

      // Fire and forget EDM for newly posted Night Overview recap: notify club recipients
      try {
        const dbSnapshot = readDb();
        const night = dbSnapshot.nights.find((n) => n.id === movieNightId);
        if (night) {
          sendEdm({
            type: "overview",
            subject: `Movie Club Recap: ${newOverview.title}`,
            html: generateNightOverviewEmailHtml(newOverview, night, dbSnapshot.reviews || []),
            previewText: `${newOverview.author} has published the official session chronicle: ${newOverview.title}`
          }).catch((edmErr) => {
            console.error("Async EDM dispatch error on overview:", edmErr);
          });
        }
      } catch (err) {
        console.error("Failed to initiate overview EDM:", err);
      }

      res.json({
        message: "Night overview posted successfully",
        overview: {
          ...newOverview,
          imageUrl: newOverview.imageUrl.startsWith("data:image/")
            ? `/api/overviews/${newOverview.id}/image`
            : newOverview.imageUrl
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to save night overview" });
    }
  });

  // --- EDM API ENDPOINTS ---

  // Get EDM distribution list and history logs (Admins only)
  app.get("/api/edm", (req, res) => {
    try {
      const db = readDb();
      res.json({
        recipients: db.edmRecipients || [],
        logs: db.edmLogs || []
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch EDM settings and logs" });
    }
  });

  // Add / Save EDM recipient emails (Admins only: James or Ash)
  app.post("/api/edm/recipients", async (req, res) => {
    const { email, name, requester } = req.body;
    const reqLower = requester?.toLowerCase();
    if (!requester || (reqLower !== "james" && reqLower !== "ash")) {
      return res.status(403).json({ error: "Unauthorized. Only admins (James or Ash) can manage EDM recipients." });
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      const updatedRecipients = await mutateDb((db) => {
        if (!db.edmRecipients) db.edmRecipients = [];
        const exists = db.edmRecipients.some((r) => r.email.toLowerCase() === cleanEmail);
        if (!exists) {
          db.edmRecipients.push({
            email: cleanEmail,
            name: name?.trim() || cleanEmail.split("@")[0],
            addedAt: new Date().toISOString()
          });
        }
        return db.edmRecipients;
      });

      res.json({ message: "Recipient added successfully", recipients: updatedRecipients });
    } catch (error) {
      res.status(500).json({ error: "Failed to save recipient" });
    }
  });

  // Delete an EDM recipient email (Admins only)
  app.delete("/api/edm/recipients", async (req, res) => {
    const { email, requester } = req.body;
    const reqLower = requester?.toLowerCase();
    if (!requester || (reqLower !== "james" && reqLower !== "ash")) {
      return res.status(403).json({ error: "Unauthorized. Only admins can manage EDM recipients." });
    }

    if (!email) {
      return res.status(400).json({ error: "Missing email to remove." });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      const updatedRecipients = await mutateDb((db) => {
        if (!db.edmRecipients) db.edmRecipients = [];
        db.edmRecipients = db.edmRecipients.filter((r) => r.email.toLowerCase() !== cleanEmail);
        return db.edmRecipients;
      });

      res.json({ message: "Recipient removed successfully", recipients: updatedRecipients });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove recipient" });
    }
  });

  // Send an EDM test transmission to verify dispatching works (Admins only)
  app.post("/api/edm/test", async (req, res) => {
    const { requester } = req.body;
    const reqLower = requester?.toLowerCase();
    if (!requester || (reqLower !== "james" && reqLower !== "ash")) {
      return res.status(403).json({ error: "Unauthorized. Only admins can initiate EDM test broadcasts." });
    }

    try {
      const db = readDb();
      const adminUser = db.users.find(u => u.username.toLowerCase() === reqLower);
      const adminName = adminUser?.name || requester;
      const recipientCount = (db.edmRecipients || []).length;

      const testLog = await sendEdm({
        type: "test",
        subject: `[TEST] Movie Club EDM Transmission Verification - ${adminName}`,
        html: generateTestEmailHtml(adminName, recipientCount),
        previewText: `EDM system check triggered by ${adminName}. Distribution pipeline verified.`
      });

      res.json({
        message: testLog.status === "failed" 
          ? "Test EDM recorded error: " + testLog.error
          : "Test EDM broadcast completed successfully!",
        log: testLog,
        logs: readDb().edmLogs || []
      });
    } catch (error: any) {
      console.error("Failed to dispatch test EDM:", error);
      res.status(500).json({ error: error?.message || "Failed to dispatch test EDM" });
    }
  });

  // Catch unmatched API routes and return structured JSON (prevents HTML error leakage)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found.` });
  });

  // --- VITE MIDDLEWARE & STATIC FILE SERVING ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Movie Club Server booted and running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
