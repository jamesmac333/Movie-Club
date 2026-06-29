import React, { useState, useEffect } from "react";
import { MovieNight, Review, NightOverview, User, MOVIE_CLUB_USERS } from "./types.ts";
import LoginScreen from "./components/LoginScreen.tsx";
import UserProfileModal from "./components/UserProfileModal.tsx";
import NextMovieHero from "./components/NextMovieHero.tsx";
import CalendarView from "./components/CalendarView.tsx";
import FeedView from "./components/FeedView.tsx";
import OverviewForm from "./components/OverviewForm.tsx";
import PriorSessionRecap from "./components/PriorSessionRecap.tsx";
import GroupStatistics from "./components/GroupStatistics.tsx";
import SelectionAlertModal from "./components/SelectionAlertModal.tsx";
import { Film, Calendar, Compass, BookOpen, Sparkles, Clapperboard, Heart, KeyRound, LogOut, ShieldCheck, User as UserIcon, Home } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [nights, setNights] = useState<MovieNight[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [overviews, setOverviews] = useState<NightOverview[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [clubUsers, setClubUsers] = useState<User[]>(MOVIE_CLUB_USERS);
  const [showProfileSettings, setShowProfileSettings] = useState<boolean>(false);
  const [newSelectionAlert, setNewSelectionAlert] = useState<MovieNight | null>(null);
  
  // App navigation state: 'landing' | 'calendar' | 'feed' | 'writer'
  const [activeTab, setActiveTab] = useState<string>("landing");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Load user session from sessionStorage on startup
  useEffect(() => {
    const saved = sessionStorage.getItem("movie_club_user");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
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
          return {
            ...staticUser,
            avatarUrl: dbUser?.avatarUrl || staticUser.avatarUrl
          };
        });
        setClubUsers(merged);

        // Update session storage and current user in state if avatar changed
        const saved = sessionStorage.getItem("movie_club_user");
        if (saved) {
          const currentLocal = JSON.parse(saved) as User;
          const updatedSelf = merged.find(u => u.username.toLowerCase() === currentLocal.username.toLowerCase());
          if (updatedSelf) {
            const newSelf = { ...currentLocal, ...updatedSelf };
            setCurrentUser(newSelf);
            sessionStorage.setItem("movie_club_user", JSON.stringify(newSelf));
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

      if (!nightsRes.ok || !reviewsRes.ok || !overviewsRes.ok) {
        throw new Error("Failed to load server data");
      }

      const nightsData = await nightsRes.json();
      const reviewsData = await reviewsRes.json();
      const overviewsData = await overviewsRes.json();

      setNights(nightsData);
      setReviews(reviewsData);
      setOverviews(overviewsData);
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

      if (nightsRes.ok && reviewsRes.ok && overviewsRes.ok) {
        const nightsData = await nightsRes.json();
        const reviewsData = await reviewsRes.json();
        const overviewsData = await overviewsRes.json();

        setNights(nightsData);
        setReviews(reviewsData);
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

  // Detect newly selected movie nights for alerts
  useEffect(() => {
    if (!currentUser || nights.length === 0) return;

    let seen: Record<string, string> = {};
    try {
      const saved = localStorage.getItem("movie_club_seen_selections");
      if (saved) {
        seen = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to parse seen selections", e);
    }

    const unacknowledged = nights.find((night) => {
      if (!night.movie) return false;

      // Check if current user is the selector or if their names match
      const isCurrentUserSelector =
        night.selector.toLowerCase() === currentUser.name.toLowerCase() ||
        night.selector.toLowerCase() === currentUser.username.toLowerCase() ||
        night.movie.selectedBy?.toLowerCase() === currentUser.name.toLowerCase() ||
        night.movie.selectedBy?.toLowerCase() === currentUser.username.toLowerCase();

      if (isCurrentUserSelector) return false;

      const alreadySeen = seen[night.id] === night.movie.title;
      return !alreadySeen;
    });

    if (unacknowledged) {
      if (!newSelectionAlert || newSelectionAlert.id !== unacknowledged.id || newSelectionAlert.movie?.title !== unacknowledged.movie?.title) {
        setNewSelectionAlert(unacknowledged);
      }
    } else {
      if (newSelectionAlert) {
        setNewSelectionAlert(null);
      }
    }
  }, [nights, currentUser, newSelectionAlert]);

  const handleAcknowledgeSelection = (nightId: string, movieTitle: string) => {
    let seen: Record<string, string> = {};
    try {
      const saved = localStorage.getItem("movie_club_seen_selections");
      if (saved) {
        seen = JSON.parse(saved);
      }
    } catch (e) {}

    seen[nightId] = movieTitle;
    localStorage.setItem("movie_club_seen_selections", JSON.stringify(seen));
    setNewSelectionAlert(null);
  };

  const handleLogin = (user: User) => {
    // Resolve dynamic details from the merged list if already fetched
    const dbUser = clubUsers.find(u => u.username.toLowerCase() === user.username.toLowerCase());
    const finalUser = dbUser ? { ...user, ...dbUser } : user;
    setCurrentUser(finalUser);
    sessionStorage.setItem("movie_club_user", JSON.stringify(finalUser));
    fetchUsers();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem("movie_club_user");
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

  // API Call: Force event status watched/scheduled (called from CalendarView)
  const handleForceStatus = async (id: string, newStatus: 'scheduled' | 'watched') => {
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

    await fetchInitialData();
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

    await fetchInitialData();
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

    await fetchInitialData();
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

    await fetchInitialData();
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

    await fetchInitialData();
    setActiveTab("feed"); // Redirect to feed to let everyone see!
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

  const isAsh = currentUser?.username?.toLowerCase() === "ash" || currentUser?.isAsh === true;

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

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100 font-sans selection:bg-amber-500 selection:text-zinc-950 flex flex-col md:flex-row">
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
      </AnimatePresence>
      
      {/* LEFT SIDEBAR - Desktop only */}
      <aside className="hidden md:flex w-[280px] bg-[#0c0c0c] border-r border-zinc-800/40 flex-col h-screen sticky top-0 overflow-y-auto shrink-0 z-30 justify-between">
        <div className="flex flex-col">
          <div className="p-8 pb-4">
            <h1 
              className="text-2xl font-serif tracking-widest text-amber-500 italic cursor-pointer font-bold select-none hover:opacity-90 transition-opacity" 
              onClick={() => setActiveTab("landing")}
            >
              MOVIE CLUB
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">Fortnightly • NZT 19:00</p>
          </div>
          
          <div className="px-8 mt-8">
            <h2 className="text-xs uppercase tracking-widest text-zinc-400 mb-4 border-b border-zinc-800/80 pb-2 font-mono">Rotation Schedule</h2>
            <ul className="space-y-4">
              {sortedNightsForRotation.length > 0 ? (
                sortedNightsForRotation.slice(0, 6).map((night) => {
                  const isNext = nextUpcomingNight && nextUpcomingNight.id === night.id;
                  const isPast = night.status === "watched";
                  const u = clubUsers.find(
                    user => user.username.toLowerCase() === night.selector.toLowerCase() ||
                            user.name.toLowerCase() === night.selector.toLowerCase()
                  );
                  return (
                    <li key={night.id} className={`flex items-center gap-3 transition-all ${isPast ? 'opacity-40' : ''}`}>
                      {u?.avatarUrl ? (
                        <img 
                          src={u.avatarUrl} 
                          alt={night.selector}
                          className={`w-6 h-6 rounded-full object-cover shrink-0 ${
                            isNext ? 'border border-amber-500/80 shadow-[0_0_6px_rgba(245,158,11,0.3)]' : 'border border-zinc-800'
                          }`}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isNext 
                            ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' 
                            : 'bg-zinc-600'
                        }`} />
                      )}
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] text-zinc-500 font-mono">{formatNZTMonthDay(night.date)}</span>
                        <span className={`text-xs truncate ${isNext ? 'font-semibold text-zinc-100' : 'text-zinc-400'}`}>{night.selector}</span>
                      </div>
                      {isNext && (
                        <span className="ml-auto text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-mono">Next</span>
                      )}
                      {isPast && (
                        <span className="ml-auto text-[9px] bg-zinc-800/50 text-zinc-500 px-1 py-0.5 rounded font-mono">Past</span>
                      )}
                    </li>
                  );
                })
              ) : (
                <p className="text-xs text-zinc-600 italic">No schedules loaded...</p>
              )}
            </ul>
          </div>
        </div>

        <div className="p-6 bg-[#0a0a0a] border-t border-zinc-900/60 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {(() => {
              const u = clubUsers.find(
                user => user.username.toLowerCase() === currentUser.username.toLowerCase() ||
                        user.name.toLowerCase() === currentUser.name.toLowerCase()
              );
              return u?.avatarUrl ? (
                <img 
                  src={u.avatarUrl} 
                  alt={currentUser.name} 
                  className="w-9 h-9 rounded-full object-cover border border-amber-500/30"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-xs font-bold text-amber-500 uppercase">
                  {currentUser.name.substring(0, 2)}
                </div>
              );
            })()}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-zinc-100 truncate">{currentUser.name}</span>
              <span className="text-[9px] text-zinc-500 uppercase tracking-tighter">
                {currentUser.username === "Ash" ? "Night Writer & Admin" : currentUser.isAdmin ? "Admin" : "Club Member"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowProfileSettings(true)}
              className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-500/80" />
              Reset Pass / Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-2 bg-zinc-950 hover:bg-red-950/40 hover:text-red-400 text-zinc-400 hover:border-red-900/40 border border-zinc-900 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN PANEL */}
      <div className="flex-1 flex flex-col min-h-screen relative pb-20 md:pb-8">
        
        {/* DESKTOP STICKY HEADER NAV */}
        <header className="hidden md:flex items-center justify-between px-12 py-6 border-b border-zinc-900/40 bg-[#080808]/75 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
              {activeTab === "landing" ? "Home" : activeTab === "calendar" ? "Full Schedule" : activeTab === "feed" ? "Memories & Feed" : "Night Writer Recap"}
            </span>
          </div>
          <div className="flex gap-8 items-center">
            <button 
              onClick={() => setActiveTab("landing")} 
              className={`text-[11px] uppercase tracking-widest hover:text-white transition-all cursor-pointer ${
                activeTab === "landing" 
                  ? "text-amber-500 font-bold underline underline-offset-8 decoration-amber-500" 
                  : "text-zinc-400"
              }`}
            >
              Home
            </button>
            <button 
              onClick={() => setActiveTab("calendar")} 
              className={`text-[11px] uppercase tracking-widest hover:text-white transition-all cursor-pointer ${
                activeTab === "calendar" 
                  ? "text-amber-500 font-bold underline underline-offset-8 decoration-amber-500" 
                  : "text-zinc-400"
              }`}
            >
              Schedule
            </button>
            <button 
              onClick={() => setActiveTab("feed")} 
              className={`text-[11px] uppercase tracking-widest hover:text-white transition-all cursor-pointer ${
                activeTab === "feed" 
                  ? "text-amber-500 font-bold underline underline-offset-8 decoration-amber-500" 
                  : "text-zinc-400"
              }`}
            >
              Memories
            </button>
            {isAsh && (
              <button 
                onClick={() => setActiveTab("writer")} 
                className={`text-[11px] uppercase tracking-widest hover:text-white transition-all cursor-pointer ${
                  activeTab === "writer" 
                    ? "text-amber-500 font-bold underline underline-offset-8 decoration-amber-500" 
                    : "text-zinc-400"
                }`}
              >
                Night Writer
              </button>
            )}
          </div>
        </header>

        {/* MOBILE HEADER SECTION */}
        <header className="md:hidden bg-[#0c0c0c] border-b border-zinc-900 sticky top-0 z-40">
          <div className="px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab("landing")}>
              <div className="relative p-1.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg">
                <Clapperboard className="w-4 h-4 text-zinc-950" />
              </div>
              <div>
                <span className="font-serif font-bold text-base tracking-tight text-zinc-100 block">
                  Movie Club
                </span>
                <span className="text-[9px] font-mono tracking-wider text-zinc-500 uppercase block -mt-1">
                  NZT 19:00
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowProfileSettings(true)}
                className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1 hover:text-amber-500 hover:border-amber-500/30 transition-all cursor-pointer"
                title="Credentials Settings"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-500/80" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/30 text-zinc-400 rounded-lg transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* MOBILE BOTTOM TAB BAR */}
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-[#0c0c0c]/95 border-t border-zinc-900/80 z-40 backdrop-blur-md py-2.5 flex justify-around px-4">
          <button
            onClick={() => setActiveTab("landing")}
            className={`flex flex-col items-center gap-1 transition-all text-[10px] font-medium cursor-pointer ${
              activeTab === "landing" ? "text-amber-500" : "text-zinc-500"
            }`}
          >
            <Home className="w-4.5 h-4.5" />
            <span>Home</span>
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex flex-col items-center gap-1 transition-all text-[10px] font-medium cursor-pointer ${
              activeTab === "calendar" ? "text-amber-500" : "text-zinc-500"
            }`}
          >
            <Calendar className="w-4.5 h-4.5" />
            <span>Schedule</span>
          </button>
          <button
            onClick={() => setActiveTab("feed")}
            className={`flex flex-col items-center gap-1 transition-all text-[10px] font-medium cursor-pointer ${
              activeTab === "feed" ? "text-amber-500" : "text-zinc-500"
            }`}
          >
            <Heart className="w-4.5 h-4.5" />
            <span>Memories</span>
          </button>
          {isAsh && (
            <button
              onClick={() => setActiveTab("writer")}
              className={`flex flex-col items-center gap-1 transition-all text-[10px] font-medium cursor-pointer ${
                activeTab === "writer" ? "text-amber-500" : "text-zinc-500"
              }`}
            >
              <BookOpen className="w-4.5 h-4.5" />
              <span>Recap</span>
            </button>
          )}
        </div>

        {/* ERROR DISPLAY */}
        {error && (
          <div className="px-6 md:px-12 mt-6 w-full">
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
        <main className="flex-1 px-4 sm:px-8 md:px-12 py-8 w-full max-w-5xl">
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
                    <NextMovieHero 
                      nights={nights} 
                      currentUser={currentUser} 
                      onChooseMovie={handleChooseMovie} 
                      onResetMovie={handleResetMovie}
                      users={clubUsers}
                    />
                    <CalendarView 
                      nights={nights.slice(0, 3)} // Show quick snapshot of next 3 nights
                      currentUser={currentUser}
                      onUpdateDate={handleUpdateDate}
                      users={clubUsers}
                    />
                    
                    {/* Classy Footer Info Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-900/10 border border-zinc-900 rounded-3xl p-6 sm:p-8 mt-12 text-center md:text-left font-sans">
                      <div>
                        <h4 className="font-serif font-bold text-lg text-zinc-200">The 14-Day Cycle</h4>
                        <p className="text-zinc-400 text-sm mt-1">Every second Friday at 7 PM NZT. Rotate turns deterministically through our 6 friends.</p>
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-lg text-zinc-200">Reviews & Ratings</h4>
                        <p className="text-zinc-400 text-sm mt-1">Reviewing watched films keeps our club rating alive and preserves our historic movie ledger!</p>
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-lg text-zinc-200">Ash's Recaps</h4>
                        <p className="text-zinc-400 text-sm mt-1">The next day, Ash documents our collective laughter, arguments, food logs, and posts a gathering image.</p>
                      </div>
                    </div>

                    {/* Prior Session Recap & Member Reviews */}
                    <PriorSessionRecap nights={nights} reviews={reviews} overviews={overviews} />

                    {/* Group Statistics Dashboard */}
                    <GroupStatistics nights={nights} reviews={reviews} users={clubUsers} />
                  </div>
                )}

                {activeTab === "calendar" && (
                  <CalendarView 
                    nights={nights} 
                    currentUser={currentUser} 
                    onUpdateDate={handleUpdateDate}
                    onForceStatus={handleForceStatus}
                    users={clubUsers}
                  />
                )}

                {activeTab === "feed" && (
                  <FeedView 
                    nights={nights}
                    reviews={reviews}
                    overviews={overviews}
                    currentUser={currentUser}
                    onAddReview={handleAddReview}
                    onEditReview={handleEditReview}
                    onDeleteReview={handleDeleteReview}
                    onToggleStarReview={handleToggleStarReview}
                    onDeleteOverview={handleDeleteOverview}
                  />
                )}

                {activeTab === "writer" && isAsh && (
                  <OverviewForm 
                    nights={nights}
                    currentUser={currentUser}
                    onPostOverview={handlePostOverview}
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
