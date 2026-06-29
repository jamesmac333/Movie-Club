import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { readDb, writeDb } from "./server/db.ts";
import { fetchMovieMetadata } from "./server/gemini.ts";
import { MovieNight, Review, NightOverview } from "./src/types.ts";

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

  // Auth: Get users
  app.get("/api/users", (req, res) => {
    try {
      const db = readDb();
      const safeUsers = db.users.map(({ password, ...u }) => u);
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
  app.get("/api/nights", (req, res) => {
    try {
      const db = readDb();
      res.json(db.nights);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movie nights" });
    }
  });

  // 2. Update a movie night's date (Admin only: James or Ash)
  app.put("/api/nights/:id/date", (req, res) => {
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
      const db = readDb();
      const nightIndex = db.nights.findIndex((n) => n.id === id);
      if (nightIndex === -1) {
        return res.status(404).json({ error: "Movie night not found" });
      }

      db.nights[nightIndex].date = date;
      writeDb(db);
      res.json({ message: "Date updated successfully", night: db.nights[nightIndex] });
    } catch (error) {
      res.status(500).json({ error: "Failed to update date" });
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
      const db = readDb();
      const nightIndex = db.nights.findIndex((n) => n.id === id);
      if (nightIndex === -1) {
        return res.status(404).json({ error: "Movie night not found" });
      }

      const night = db.nights[nightIndex];

      // Security check: must be either the assigned selector, or an admin (James/Ash)
      const isSelector = selector && selector.toLowerCase() === requesterName?.toLowerCase();
      const isAdmin = requester?.toLowerCase() === "james" || requester?.toLowerCase() === "ash";

      if (!isSelector && !isAdmin) {
        return res.status(403).json({ 
          error: `Unauthorized. Only the assigned selector (${night.selector}) or an admin can choose the movie.` 
        });
      }

      // Fetch metadata from Gemini SDK (acting as themoviedb online proxy)
      const metadata = await fetchMovieMetadata(movieTitle, night.selector);
      
      db.nights[nightIndex].movie = metadata;
      
      // If date is in the past compared to current time, mark it watched, else scheduled
      const nightDate = new Date(night.date);
      const now = new Date();
      db.nights[nightIndex].status = nightDate < now ? "watched" : "scheduled";

      writeDb(db);
      res.json({ message: "Movie selected and metadata pulled successfully", night: db.nights[nightIndex] });
    } catch (error) {
      console.error("Error choosing movie:", error);
      res.status(500).json({ error: "Failed to pull movie metadata or update selection" });
    }
  });

  // 3.5. Reset a movie night's movie choice (The selector or admin)
  app.post("/api/nights/:id/reset-movie", (req, res) => {
    const { id } = req.params;
    const { requester, requesterName } = req.body;

    try {
      const db = readDb();
      const nightIndex = db.nights.findIndex((n) => n.id === id);
      if (nightIndex === -1) {
        return res.status(404).json({ error: "Movie night not found" });
      }

      const night = db.nights[nightIndex];

      // Security check: must be either the assigned selector, or an admin (James/Ash)
      const isSelector = night.selector && (
        night.selector.toLowerCase() === requesterName?.toLowerCase() ||
        night.selector.toLowerCase() === requester?.toLowerCase()
      );
      const isAdmin = requester?.toLowerCase() === "james" || requester?.toLowerCase() === "ash";

      if (!isSelector && !isAdmin) {
        return res.status(403).json({ 
          error: `Unauthorized. Only the assigned selector (${night.selector}) or an admin can reset this choice.` 
        });
      }

      db.nights[nightIndex].movie = null;
      db.nights[nightIndex].status = "scheduled"; // revert back to scheduled

      writeDb(db);
      res.json({ message: "Movie selection reset successfully", night: db.nights[nightIndex] });
    } catch (error) {
      console.error("Error resetting movie selection:", error);
      res.status(500).json({ error: "Failed to reset movie selection" });
    }
  });

  // 4. Force status update (mark watched) - helpful for testing & admin
  app.put("/api/nights/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, requester } = req.body;

    if (requester?.toLowerCase() !== "james" && requester?.toLowerCase() !== "ash") {
      return res.status(403).json({ error: "Only admins can change event status." });
    }

    try {
      const db = readDb();
      const index = db.nights.findIndex(n => n.id === id);
      if (index === -1) return res.status(404).json({ error: "Not found" });

      db.nights[index].status = status;
      writeDb(db);
      res.json(db.nights[index]);
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

  // 6. Submit a new review
  app.post("/api/reviews", (req, res) => {
    const { movieNightId, user, rating, comment } = req.body;

    if (!movieNightId || !user || !rating || !comment) {
      return res.status(400).json({ error: "Missing review fields (movieNightId, user, rating, comment)" });
    }

    try {
      const db = readDb();
      const newReview: Review = {
        id: `rev-${Date.now()}`,
        movieNightId,
        user,
        rating: Number(rating),
        comment,
        createdAt: new Date().toISOString()
      };

      db.reviews.push(newReview);
      
      // Auto upgrade movie status to watched when reviewed
      const nightIndex = db.nights.findIndex(n => n.id === movieNightId);
      if (nightIndex !== -1 && db.nights[nightIndex].status === "scheduled") {
        db.nights[nightIndex].status = "watched";
      }

      writeDb(db);
      res.json({ message: "Review posted successfully", review: newReview });
    } catch (error) {
      res.status(500).json({ error: "Failed to save review" });
    }
  });

  // 7. Edit a review (Author or Admin James/Ash)
  app.put("/api/reviews/:id", (req, res) => {
    const { id } = req.params;
    const { rating, comment, requester, requesterName } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({ error: "Missing comment or rating" });
    }

    try {
      const db = readDb();
      const index = db.reviews.findIndex((r) => r.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Review not found" });
      }

      const review = db.reviews[index];
      const isAuthor = review.user === requesterName;
      const isAdmin = requester?.toLowerCase() === "james" || requester?.toLowerCase() === "ash";

      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ error: "Unauthorized. You can only edit your own reviews." });
      }

      db.reviews[index].rating = Number(rating);
      db.reviews[index].comment = comment;
      db.reviews[index].createdAt = new Date().toISOString(); // update timestamp

      writeDb(db);
      res.json({ message: "Review updated successfully", review: db.reviews[index] });
    } catch (error) {
      res.status(500).json({ error: "Failed to edit review" });
    }
  });

  // Auth: Star a review (Ash Only)
  app.put("/api/reviews/:id/star", (req, res) => {
    const { id } = req.params;
    const { requester } = req.body;

    const reqLower = requester?.toLowerCase();
    if (!requester || (reqLower !== "ash" && reqLower !== "james")) { // although james is also admin, let's keep it to Ash primarily or any admin
      // user request: "Please also give Ash the ability to star her favourite review for each session"
      // Ash is "ash". Let's restrict strictly to "ash" or allow any admin but check "ash" first. Let's enforce "ash"!
    }

    if (reqLower !== "ash") {
      return res.status(403).json({ error: "Unauthorized. Only Ash Macintosh can star reviews." });
    }

    try {
      const db = readDb();
      const reviewIndex = db.reviews.findIndex((r) => r.id === id);
      if (reviewIndex === -1) {
        return res.status(404).json({ error: "Review not found" });
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

      writeDb(db);
      res.json({ message: "Review star status updated successfully", review: db.reviews[reviewIndex] });
    } catch (error) {
      res.status(500).json({ error: "Failed to update review star status" });
    }
  });

  // 8. Delete a review (Author or Admin James/Ash)
  app.delete("/api/reviews/:id", (req, res) => {
    const { id } = req.params;
    const { requester, requesterName } = req.body;

    try {
      const db = readDb();
      const index = db.reviews.findIndex((r) => r.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Review not found" });
      }

      const review = db.reviews[index];
      const isAuthor = review.user === requesterName;
      const isAdmin = requester?.toLowerCase() === "james" || requester?.toLowerCase() === "ash";

      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ error: "Unauthorized. You can only delete your own reviews." });
      }

      db.reviews.splice(index, 1);
      writeDb(db);
      res.json({ message: "Review deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // Delete a night overview (Admins and Ash Macintosh)
  app.delete("/api/overviews/:id", (req, res) => {
    const { id } = req.params;
    const { requester } = req.body;

    const reqLower = requester?.toLowerCase();
    if (!requester) {
      return res.status(400).json({ error: "Missing requester username" });
    }

    try {
      const db = readDb();
      const user = db.users.find(u => u.username.toLowerCase() === reqLower);
      const isAuthorized = reqLower === "ash" || reqLower === "james" || user?.isAdmin;

      if (!isAuthorized) {
        return res.status(403).json({ error: "Unauthorized. Only Ash Macintosh or Admins can delete overviews." });
      }

      const index = db.overviews.findIndex((ov) => ov.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Overview not found" });
      }

      db.overviews.splice(index, 1);
      writeDb(db);
      res.json({ message: "Overview deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete overview" });
    }
  });

  // 9. Get all night overviews
  app.get("/api/overviews", (req, res) => {
    try {
      const db = readDb();
      res.json(db.overviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch night overviews" });
    }
  });

  // 10. Post a new night overview (Only Ash Macintosh)
  app.post("/api/overviews", (req, res) => {
    const { movieNightId, title, content, imageUrl, requester } = req.body;

    // Explicit security check: Only Ash can post overviews
    if (requester?.toLowerCase() !== "ash") {
      return res.status(403).json({ error: "Unauthorized. Only Ash Macintosh can write night overviews." });
    }

    if (!movieNightId || !title || !content || !imageUrl) {
      return res.status(400).json({ error: "Missing required overview fields" });
    }

    try {
      const db = readDb();
      
      // Check if night exists
      const nightIndex = db.nights.findIndex((n) => n.id === movieNightId);
      if (nightIndex === -1) {
        return res.status(404).json({ error: "Movie night not found" });
      }

      const newOverview: NightOverview = {
        id: `ov-${Date.now()}`,
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
        db.overviews[existingOvIndex] = newOverview;
      } else {
        db.overviews.push(newOverview);
      }

      // Mark the movie night as watched
      db.nights[nightIndex].status = "watched";

      writeDb(db);
      res.json({ message: "Night overview posted successfully", overview: newOverview });
    } catch (error) {
      res.status(500).json({ error: "Failed to save night overview" });
    }
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
