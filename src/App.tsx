import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MovieNight, Review, NightOverview, User, MOVIE_CLUB_USERS } from "./types.ts";
import { getSealedNightIds } from "./reviewSeal.ts";
import { gapFillProgress } from "./clubStats.ts";
import { DATA_LOSS_DATE } from "./dataLoss.ts";
import { WithGapBadge } from "./components/GapBadge.tsx";
import LoginScreen from "./components/LoginScreen.tsx";
import UserProfileModal from "./components/UserProfileModal.tsx";
import NextMovieHero from "./components/NextMovieHero.tsx";
import CalendarView from "./components/CalendarView.tsx";
import FeedView from "./components/FeedView.tsx";
import PriorSessionRecap from "./components/PriorSessionRecap.tsx";
import GroupStatistics from "./components/GroupStatistics.tsx";
import SelectionAlertModal from "./components/SelectionAlertModal.tsx";
import RecapAlertModal from "./components/RecapAlertModal.tsx";
import { Film, Calendar, Compass, BookOpen, Sparkles, Clapperboard, Heart, KeyRound, LogOut, ShieldCheck, User as UserIcon, Home, Mail } from "lucide-react";
import { motion, AnimatePresence, useScroll, useSpring } from "motion/react";
import { getToken, clearSession, getSavedUser, saveUser } from "./auth.ts";
import JustWatchedCard from "./components/JustWatchedCard.tsx";
import PaletteStrip from "./components/PaletteStrip.tsx";
import HomeScreenHint from "./components/HomeScreenHint.tsx";
import GapFillCard from "./components/GapFillCard.tsx";
import AdminView from "./components/AdminView.tsx";
import RecapPromptCard from "./components/RecapPromptCard.tsx";
import FilmPage from "./components/FilmPage.tsx";
import MemberPage from "./components/MemberPage.tsx";
import OfflineNotice from "./components/OfflineNotice.tsx";
import { CLUB_PALETTE } from "./palette.ts";

export default function App() {
  const [nights, setNights] = useState<MovieNight[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [overviews, setOverviews] = useState<NightOverview[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [clubUsers, setClubUsers] = useState<User[]>(MOVIE_CLUB_USERS);
  const [showProfileSettings, setShowProfileSettings] = useState<boolean>(false);
  const [newSelectionAlert, setNewSelectionAlert] = useState<MovieNight | null>(null);
  const [newRecapAlert, setNewRecapAlert] = useState<{ overview: NightOverview; night: MovieNight } | null>(null);

  // Recent nights whose reviews stay hidden until the current member has posted theirs
  const sealedNightIds = useMemo(() => getSealedNightIds(nights, reviews, currentUser?.name), [nights, reviews, currentUser]);
  const openReviews = useMemo(
    () => reviews.filter((r) => r.user === currentUser?.name || !sealedNightIds.has(r.movieNightId)),
    [reviews, currentUser, sealedNightIds]
  );

  // Members who've filled in every lost night get a badge on their photo
  const members = useMemo(
    () => clubUsers.map((u) => ({ ...u, hasGapBadge: gapFillProgress(nights, reviews, u.name, DATA_LOSS_DATE).complete })),
    [clubUsers, nights, reviews]
  );

  // Film and member pages open over the current tab; opening one from another stacks them
  type Page = { type: "film"; id: string } | { type: "member"; name: string };
  const [pages, setPages] = useState<Page[]>([]);
  const openFilm = (id: string) => setPages((prev) => [...prev, { type: "film", id }]);
  const openMember = (name: string) => setPages((prev) => [...prev, { type: "member", name }]);
  const closePage = useCallback(() => setPages((prev) => prev.slice(0, -1)), []);

  // App navigation state: 'landing' | 'calendar' | 'feed' | 'admin'
  const [activeTab, setActiveTab] = useState<string>("landing");
  // The night Ash tapped "Write the recap" for on Home, so the Admin tab opens on it
  const [recapNightId, setRecapNightId] = useState("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Restore the saved sign-in on startup
  useEffect(() => {
    const saved = getSavedUser();
    if (saved && !getToken()) {
      // Signed in before session tokens existed: ask them to sign in again
      clearSession();
    } else if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const staticMatch = MOVIE_CLUB_USERS.find(
          u => u.username.toLowerCase() === parsed.username?.toLowerCase()
        );
        if (staticMatch && (!parsed.avatarUrl || parsed.avatarUrl.startsWith("/src/"))) {
          parsed.avatarUrl = staticMatch.avatarUrl;
          saveUser(parsed);
        }
        setCurrentUser(parsed);
      } catch (e) {
        console.error("Failed to parse saved user", e);
      }
    }
    fetchInitialData();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const dbUsers: User[] = await res.json();
        const merged = MOVIE_CLUB_USERS.map(staticUser => {
          const dbUser = dbUsers.find(u => u.username.toLowerCase() === staticUser.username.toLowerCase());
          const dbAvatar = dbUser?.avatarUrl;
          const hasValidCustomAvatar = dbAvatar && !dbAvatar.startsWith("/src/") && dbAvatar.trim().length > 0;
          return {
            ...staticUser,
            isAdmin: dbUser?.isAdmin !== undefined ? dbUser.isAdmin : staticUser.isAdmin,
            isAsh: dbUser?.isAsh !== undefined ? dbUser.isAsh : staticUser.isAsh,
            // The server's ?v= fingerprint changes when the photo changes, so it is safe to cache
            avatarUrl: hasValidCustomAvatar ? dbAvatar : staticUser.avatarUrl
          };
        });
        setClubUsers(merged);

        // Update session storage and current user in state if avatar changed
        const saved = getSavedUser();
        if (saved) {
          const currentLocal = JSON.parse(saved) as User;
          const updatedSelf = merged.find(u => u.username.toLowerCase() === currentLocal.username.toLowerCase());
          if (updatedSelf) {
            const newSelf = { ...currentLocal, ...updatedSelf };
            setCurrentUser(newSelf);
            saveUser(newSelf);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch dynamic users", e);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [nightsRes, reviewsRes, overviewsRes] = await Promise.all([
        fetch("/api/nights"),
        fetch("/api/reviews"),
        fetch("/api/overviews")
      ]);

      // Nights are the core application data
      if (!nightsRes.ok) {
        throw new Error("Failed to load server data");
      }

      const nightsData = await nightsRes.json();
      setNights(nightsData);

      // Reviews resilience
      if (reviewsRes.ok) {
        try {
          const reviewsData = await reviewsRes.json();
          setReviews(reviewsData);
        } catch (revErr) {
          console.warn("Could not parse reviews JSON", revErr);
        }
      }

      // Overviews recap resilience (does not take down the entire club portal if an overview photo is large)
      if (overviewsRes.ok) {
        try {
          const overviewsData = await overviewsRes.json();
          setOverviews(overviewsData);
        } catch (ovErr) {
          console.warn("Could not parse overviews JSON", ovErr);
        }
      } else {
        console.warn("Overviews endpoint returned status", overviewsRes.status);
      }
    } catch (e: any) {
      setError("Failed to connect to the Movie Club server. Please refresh.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSilentData = async () => {
    try {
      const [nightsRes, reviewsRes, overviewsRes] = await Promise.all([
        fetch("/api/nights"),
        fetch("/api/reviews"),
        fetch("/api/overviews")
      ]);

      if (nightsRes.ok) {
        const nightsData = await nightsRes.json();
        setNights(nightsData);
      }
      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        setReviews(reviewsData);
      }
      if (overviewsRes.ok) {
        const overviewsData = await overviewsRes.json();
        setOverviews(overviewsData);
      }
    } catch (e) {
      console.error("Silent data sync failed", e);
    }
  };

  // Polling for live session changes every 7 seconds
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      fetchSilentData();
    }, 7000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Film picks this member has already seen announced (kept on the server, so it holds across devices)
  const [seenPicks, setSeenPicks] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    setSeenPicks(null);
    if (!currentUser) return;
    fetch("/api/me/seen-picks")
      .then((res) => (res.ok ? res.json() : null))
      .then((seen) => setSeenPicks(seen))
      .catch(() => {});
  }, [currentUser?.username]);

  // Announce the next night's film once, the first time a member visits after it's picked.
  // Nights that have already started never pop up, and neither does a member's own pick.
  useEffect(() => {
    if (!currentUser || !seenPicks) return;
    const nextNight = nights
      .filter((n) => n.status === "scheduled" && new Date(n.date).getTime() > Date.now())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    const me = [currentUser.name.toLowerCase(), currentUser.username.toLowerCase()];
    const isOwnPick = !!nextNight && (me.includes(nextNight.selector.toLowerCase()) || me.includes(nextNight.movie?.selectedBy?.toLowerCase() || ""));
    const show = nextNight?.movie && !isOwnPick && seenPicks[nextNight.id] !== nextNight.movie.title ? nextNight : null;
    setNewSelectionAlert((prev) => (prev?.id === show?.id && prev?.movie?.title === show?.movie?.title ? prev : show));
  }, [nights, currentUser, seenPicks]);

  const handleAcknowledgeSelection = (nightId: string, movieTitle: string) => {
    setSeenPicks((prev) => ({ ...prev, [nightId]: movieTitle }));
    setNewSelectionAlert(null);
    fetch("/api/me/seen-picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nightId, title: movieTitle })
    }).catch(() => {});
  };

  // Recaps arrive by email and sit on Home, so they only open in a pop-up when a member asks
  const handleCloseRecap = () => setNewRecapAlert(null);

  const handleLogin = (user: User) => {
    // Resolve dynamic details from the merged list if already fetched
    const dbUser = clubUsers.find(u => u.username.toLowerCase() === user.username.toLowerCase());
    const finalUser = dbUser ? { ...user, ...dbUser } : user;
    setCurrentUser(finalUser);
    saveUser(finalUser);
    fetchUsers();
  };

  const handleLogout = () => {
    setPages([]);
    setCurrentUser(null);
    clearSession();
  };

  // API Call: Select movie for a night (called from NextMovieHero)
  const handleChooseMovie = async (id: string, title: string, selector: string) => {
    const response = await fetch(`/api/nights/${id}/movie`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        movieTitle: title,
        selector: selector,
        requester: currentUser?.username,
        requesterName: currentUser?.name
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to update movie selection");
    }

    // Refresh application state
    await fetchInitialData();
  };

  // API Call: Reset movie selection for a night (called from NextMovieHero)
  const handleResetMovie = async (id: string) => {
    const response = await fetch(`/api/nights/${id}/reset-movie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requester: currentUser?.username,
        requesterName: currentUser?.name
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to reset movie choice");
    }

    await fetchInitialData();
  };

  // API Call: Reschedule date (called from CalendarView)
  const handleUpdateDate = async (id: string, newDate: string) => {
    const response = await fetch(`/api/nights/${id}/date`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: newDate,
        requester: currentUser?.username
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to update movie night date");
    }

    await fetchInitialData();
  };

  // API Call: Change assigned session selector / host (called from CalendarView)
  const handleUpdateSelector = async (id: string, newSelector: string, realignSubsequent: boolean = false) => {
    const response = await fetch(`/api/nights/${id}/selector`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selector: newSelector,
        requester: currentUser?.username,
        realignSubsequent: realignSubsequent
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to update assigned host");
    }

    const data = await response.json();
    if (data.nights) {
      setNights(data.nights);
    } else {
      await fetchInitialData();
    }
  };

  // API Call: Re-align all future scheduled sessions to standard rotation (Max > Ash > Madi > Amy > Tom > James)
  const handleRealignRotation = async () => {
    const response = await fetch("/api/nights/realign-rotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requester: currentUser?.username
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to realign rotation");
    }

    const data = await response.json();
    if (data.nights) {
      setNights(data.nights);
    } else {
      await fetchInitialData();
    }
  };

  // API Call: Force event status watched/scheduled (called from CalendarView)
  const handleForceStatus = async (id: string, newStatus: 'scheduled' | 'watched' | 'skipped') => {
    const response = await fetch(`/api/nights/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        requester: currentUser?.username
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to update status");
    }

    await fetchInitialData();
  };

  // API Call: Submit a new review (called from FeedView)
  const handleAddReview = async (movieNightId: string, user: string, rating: number, comment: string) => {
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        movieNightId,
        user,
        rating,
        comment
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to post review");
    }

    const data = await response.json();
    if (data.reviews) {
      setReviews(data.reviews);
    }
    if (data.nights) {
      setNights(data.nights);
    }

    // Refresh state silently to ensure all connected clients are in lockstep
    await fetchSilentData();
  };

  // API Call: Edit review (called from FeedView)
  const handleEditReview = async (id: string, rating: number, comment: string) => {
    const response = await fetch(`/api/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating,
        comment,
        requester: currentUser?.username,
        requesterName: currentUser?.name
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to edit review");
    }

    const data = await response.json();
    if (data.reviews) {
      setReviews(data.reviews);
    }

    await fetchSilentData();
  };

  // API Call: Delete review (called from FeedView)
  const handleDeleteReview = async (id: string) => {
    const response = await fetch(`/api/reviews/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requester: currentUser?.username,
        requesterName: currentUser?.name
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to delete review");
    }

    const data = await response.json();
    if (data.reviews) {
      setReviews(data.reviews);
    }

    await fetchSilentData();
  };

  // API Call: Star a review (called from FeedView - Ash Only)
  const handleToggleStarReview = async (id: string) => {
    const response = await fetch(`/api/reviews/${id}/star`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requester: currentUser?.username
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to star/unstar review");
    }

    const data = await response.json();
    if (data.reviews) {
      setReviews(data.reviews);
    }

    await fetchSilentData();
  };

  // API Call: Post a night overview recap (called from OverviewForm)
  const handlePostOverview = async (movieNightId: string, title: string, content: string, imageUrl: string) => {
    const response = await fetch("/api/overviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        movieNightId,
        title,
        content,
        imageUrl,
        requester: currentUser?.username
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to publish overview recap");
    }

    const data = await response.json();
    const createdOverview: NightOverview = data.overview || data;
    await fetchInitialData();
    setActiveTab("feed"); // Redirect to feed to let everyone see!

    // Immediately pop up the window for the user to read fully and exit out of when done
    const targetNight = nights.find((n) => n.id === movieNightId);
    if (targetNight) {
      setNewRecapAlert({ overview: createdOverview, night: targetNight });
    }
  };

  // API Call: Delete a night overview recap (Only Admins / Ash)
  const handleDeleteOverview = async (id: string) => {
    const response = await fetch(`/api/overviews/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requester: currentUser?.username
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to delete overview recap");
    }

    await fetchInitialData();
  };

  // API Call: Update an overview recap gathering photo (Only Admins / Ash)
  const handleUpdateOverviewImage = async (id: string, imageUrl: string) => {
    const response = await fetch(`/api/overviews/${id}/image`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl,
        requester: currentUser?.username
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to update gathering photo");
    }

    await fetchInitialData();
  };

  // API Call: Remove an overview recap gathering photo (Only Admins / Ash)
  const handleDeleteOverviewImage = async (id: string) => {
    const response = await fetch(`/api/overviews/${id}/image`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requester: currentUser?.username
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to remove gathering photo");
    }

    await fetchInitialData();
  };

  const isAsh = currentUser?.username?.toLowerCase() === "ash" || currentUser?.isAsh === true;
  const isAdmin = currentUser?.username?.toLowerCase() === "james" || currentUser?.isAdmin === true;
  const canManageRecaps = isAsh || isAdmin;

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const sortedNightsForRotation = [...nights].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const nextUpcomingNight = sortedNightsForRotation.find(n => n.status === "scheduled");

  const formatNZTMonthDay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-NZ", {
        day: "numeric",
        month: "short"
      }).toUpperCase();
    } catch (e) {
      return "NZT";
    }
  };

  const navItems = [
    { id: "landing", label: "Home", icon: Home },
    { id: "calendar", label: "Schedule", icon: Calendar },
    { id: "feed", label: "Memories", icon: Heart },
    ...(canManageRecaps ? [{ id: "admin", label: "Admin", icon: ShieldCheck }] : [])
  ];

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLogin} />;
  }

  const meUser = members.find((u) => u.username.toLowerCase() === currentUser.username.toLowerCase());
  const myAvatar = (size: string) => (
    <WithGapBadge show={!!meUser?.hasGapBadge} size="sm">
      {meUser?.avatarUrl ? (
        <img src={meUser.avatarUrl} alt="" className={`${size} rounded-full object-cover border border-amber-500/50`} referrerPolicy="no-referrer" />
      ) : (
        <span className={`${size} rounded-full bg-slate text-zinc-100 text-xs font-semibold flex items-center justify-center`}>{currentUser.name.substring(0, 2).toUpperCase()}</span>
      )}
    </WithGapBadge>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500 selection:text-zinc-950 flex flex-col">
      <AnimatePresence>
        {showProfileSettings && (
          <UserProfileModal 
            currentUser={currentUser} 
            onClose={() => setShowProfileSettings(false)} 
            users={clubUsers}
            onUserUpdate={fetchUsers}
          />
        )}
        {newSelectionAlert && (
          <SelectionAlertModal
            night={newSelectionAlert}
            onAcknowledge={handleAcknowledgeSelection}
          />
        )}
        {newRecapAlert && (
          <RecapAlertModal
            overview={newRecapAlert.overview}
            night={newRecapAlert.night}
            reviews={openReviews}
            currentUser={currentUser}
            onClose={handleCloseRecap}
            onUpdateOverviewImage={handleUpdateOverviewImage}
            onDeleteOverviewImage={handleDeleteOverviewImage}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(() => {
          const page = pages[pages.length - 1];
          if (!page) return null;
          if (page.type === "film") {
            const night = nights.find((n) => n.id === page.id && n.movie);
            if (!night) return null;
            return (
              <FilmPage
                night={night}
                reviews={reviews}
                sealed={sealedNightIds.has(night.id)}
                overviews={overviews}
                users={members}
                currentUser={currentUser}
                canGoBack={pages.length > 1}
                onClose={closePage}
                onOpenMember={openMember}
                onAddReview={handleAddReview}
              />
            );
          }
          const member = members.find((u) => u.name.toLowerCase() === page.name.toLowerCase());
          if (!member) return null;
          return (
            <MemberPage
              member={member}
              nights={nights}
              reviews={openReviews}
              isSelf={member.username.toLowerCase() === currentUser.username.toLowerCase()}
              canGoBack={pages.length > 1}
              onClose={closePage}
              onOpenFilm={openFilm}
              onOpenSettings={() => setShowProfileSettings(true)}
            />
          );
        })()}
      </AnimatePresence>

      <OfflineNotice />
      
      {/* DESKTOP TOP NAVIGATION */}
      <header className="hidden md:block sticky top-0 z-30 bg-ink-deep/95 backdrop-blur-md border-b border-zinc-800">
        <motion.div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500 origin-left" style={{ scaleX }} />
        <div className="max-w-6xl mx-auto h-20 px-8 flex items-center gap-10">
          <button type="button" onClick={() => setActiveTab("landing")} className="flex flex-col gap-1.5 text-left cursor-pointer">
            <span className="font-serif text-3xl leading-none text-zinc-100">Movie Club</span>
            <PaletteStrip colors={CLUB_PALETTE} className="h-1 w-36 rounded-full" />
          </button>
          <nav aria-label="Main" className="flex gap-1 flex-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={activeTab === item.id ? "page" : undefined}
                className={`h-11 px-4 rounded-xl text-[15px] font-medium cursor-pointer transition-colors ${
                  activeTab === item.id ? "bg-zinc-900 text-amber-500" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => openMember(currentUser.name)}
            className="flex items-center gap-3 h-11 pl-1 pr-4 rounded-full hover:bg-zinc-900 cursor-pointer"
            aria-label="Your page"
          >
            {myAvatar("w-9 h-9")}
            <span className="text-sm text-zinc-200">{currentUser.name.split(" ")[0]}</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            className="w-11 h-11 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-900 flex items-center justify-center cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* MOBILE HEADER */}
      <header className="md:hidden sticky top-0 z-40 bg-ink-deep/95 backdrop-blur-md border-b border-zinc-800 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <motion.div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500 origin-left" style={{ scaleX }} />
        <div className="px-4 pt-2 pb-3 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setActiveTab("landing")} className="flex flex-col gap-1 text-left cursor-pointer min-w-0">
            <span className="slate text-zinc-400 truncate">Kia ora, {currentUser.name.split(" ")[0]}</span>
            <span className="font-serif text-[28px] leading-none text-zinc-100">Movie Club</span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              className="w-11 h-11 rounded-full text-zinc-400 hover:text-red-400 flex items-center justify-center cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => openMember(currentUser.name)} aria-label="Your page" className="cursor-pointer">
              {myAvatar("w-11 h-11")}
            </button>
          </div>
        </div>
        <PaletteStrip colors={CLUB_PALETTE} className="h-1.5 mx-4 mb-3 rounded-full" />
      </header>

      {/* MOBILE BOTTOM TAB BAR */}
      <nav
        aria-label="Main"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-ink-deep/95 backdrop-blur-lg border-t border-zinc-800 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] flex select-none overscroll-contain"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const on = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => { setPages([]); setActiveTab(item.id); }}
              aria-current={on ? "page" : undefined}
              className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-1 text-[11px] font-medium cursor-pointer ${on ? "text-amber-500" : "text-zinc-400"}`}
            >
              <Icon className="w-[22px] h-[22px]" />
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => openMember(currentUser.name)}
          className="flex-1 min-h-14 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-zinc-400 cursor-pointer"
        >
          <UserIcon className="w-[22px] h-[22px]" />
          You
        </button>
      </nav>

      {/* MAIN PANEL */}
      <div className="flex-1 flex flex-col relative">

        {/* ERROR DISPLAY */}
        {error && (
          <div className="px-5 md:px-12 mt-6 w-full">
            <div className="bg-red-950/20 border border-red-900/30 text-red-400 p-4 rounded-2xl text-sm flex items-center justify-between gap-4">
              <span>{error}</span>
              <button 
                onClick={fetchInitialData} 
                className="text-xs bg-red-900/20 hover:bg-red-900/40 border border-red-900/40 text-red-300 px-2.5 py-1 rounded transition-all cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* CORE CONTENT LAYOUT */}
        <main className="flex-1 px-4 sm:px-8 py-6 md:py-10 pb-32 md:pb-16 w-full max-w-6xl mx-auto">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-zinc-800 rounded-full" />
                <div className="absolute inset-0 border-4 border-amber-500 rounded-full border-t-transparent animate-spin" />
              </div>
              <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase">Loading Theater Details...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === "landing" && (
                  <div className="space-y-12">
                    <HomeScreenHint />
                    <GapFillCard
                      nights={nights}
                      reviews={reviews}
                      currentUser={currentUser}
                      onAddReview={handleAddReview}
                    />
                    {isAsh && (
                      <RecapPromptCard
                        nights={nights}
                        overviews={overviews}
                        onWrite={(nightId) => {
                          setRecapNightId(nightId);
                          setActiveTab("admin");
                          window.scrollTo({ top: 0 });
                        }}
                      />
                    )}
                    <JustWatchedCard
                      nights={nights}
                      reviews={reviews}
                      users={clubUsers}
                      currentUser={currentUser}
                      onAddReview={handleAddReview}
                    />
                    <NextMovieHero 
                      nights={nights} 
                      currentUser={currentUser} 
                      onChooseMovie={handleChooseMovie} 
                      onResetMovie={handleResetMovie}
                      users={clubUsers}
                    />
                    {/* Coming up and last time, side by side on wide screens */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-8 items-start">
                    <CalendarView 
                      nights={nights}
                      currentUser={currentUser}
                      onUpdateDate={handleUpdateDate}
                      onUpdateSelector={handleUpdateSelector}
                      onRealignRotation={handleRealignRotation}
                      onForceStatus={handleForceStatus}
                      users={clubUsers}
                      overviews={overviews}
                      onOpenRecapModal={(overview, night) => setNewRecapAlert({ overview, night })}
                      futureOnly={true}
                      limit={3}
                      onViewFullSchedule={() => setActiveTab("calendar")}
                      title="Next 3 Upcoming Sessions"
                      subtitle="Upcoming scheduled cinema sessions in chronological order • 7:00 PM NZT"
                    />
                    <PriorSessionRecap 
                      nights={nights} 
                      reviews={reviews} 
                      sealedNightIds={sealedNightIds}
                      overviews={overviews} 
                      currentUser={currentUser}
                      onOpenRecapModal={(overview, night) => setNewRecapAlert({ overview, night })}
                      onUpdateOverviewImage={handleUpdateOverviewImage}
                      onDeleteOverviewImage={handleDeleteOverviewImage}
                      onOpenFilm={openFilm}
                    />
                    </div>

                    {/* Group Statistics Dashboard */}
                    <GroupStatistics nights={nights} reviews={openReviews} users={members} onOpenMember={openMember} />

                    <p className="text-sm leading-relaxed text-zinc-500 max-w-2xl">
                      Every second Friday at 7 pm. Hosting rotates through all six of us, the host picks the film, and Ash writes the recap the next day.
                    </p>
                  </div>
                )}

                {activeTab === "calendar" && (
                  <CalendarView 
                    nights={nights} 
                    currentUser={currentUser} 
                    onUpdateDate={handleUpdateDate}
                    onUpdateSelector={handleUpdateSelector}
                    onRealignRotation={handleRealignRotation}
                    onForceStatus={handleForceStatus}
                    users={clubUsers}
                    overviews={overviews}
                    onOpenRecapModal={(overview, night) => setNewRecapAlert({ overview, night })}
                    futureOnly={false}
                  />
                )}

                {activeTab === "feed" && (
                  <FeedView 
                    nights={nights}
                    reviews={reviews}
                    sealedNightIds={sealedNightIds}
                    overviews={overviews}
                    currentUser={currentUser}
                    onAddReview={handleAddReview}
                    onEditReview={handleEditReview}
                    onDeleteReview={handleDeleteReview}
                    onToggleStarReview={handleToggleStarReview}
                    onDeleteOverview={handleDeleteOverview}
                    onOpenRecapModal={(overview, night) => setNewRecapAlert({ overview, night })}
                    onUpdateOverviewImage={handleUpdateOverviewImage}
                    onDeleteOverviewImage={handleDeleteOverviewImage}
                    onOpenFilm={openFilm}
                  />
                )}

                {activeTab === "admin" && canManageRecaps && (
                  <AdminView
                    currentUser={currentUser}
                    nights={nights}
                    reviews={reviews}
                    overviews={overviews}
                    members={members}
                    onPostOverview={handlePostOverview}
                    onUpdateOverviewImage={handleUpdateOverviewImage}
                    onRealignRotation={handleRealignRotation}
                    onUserUpdate={fetchUsers}
                    onOpenMember={openMember}
                    recapNightId={recapNightId}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

      </div>
    </div>
  );
}
