import React, { useState, useRef, useEffect } from "react";
import { MovieNight, User, NightOverview, isAuthenticGatheringPhoto } from "../types.ts";
import { BookOpen, Camera, Upload, AlertCircle, CheckCircle, Image as ImageIcon, Sparkles, RefreshCw, Trash2, Edit } from "lucide-react";
import { motion } from "motion/react";

interface OverviewFormProps {
  nights: MovieNight[];
  currentUser: User | null;
  onPostOverview: (movieNightId: string, title: string, content: string, imageUrl: string) => Promise<void>;
  overviews?: NightOverview[];
  onUpdateOverviewImage?: (overviewId: string, imageUrl: string) => Promise<void>;
}

export default function OverviewForm({ nights, currentUser, onPostOverview, overviews = [], onUpdateOverviewImage }: OverviewFormProps) {
  const [selectedNightId, setSelectedNightId] = useState("");
  const [headline, setHeadline] = useState("");
  const [content, setContent] = useState("");
  const [imageBlob, setImageBlob] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security check: Ash Macintosh or James (admin) gets to use this form!
  const isAuthorized = currentUser?.username?.toLowerCase() === "ash" || 
                       currentUser?.username?.toLowerCase() === "james" || 
                       currentUser?.isAsh === true || 
                       currentUser?.isAdmin === true;

  // List of movie nights that have a movie selected, ready for an overview
  const reviewableNights = nights.filter(n => n.movie !== null);

  // When selectedNightId changes, pre-load existing recap data if available
  useEffect(() => {
    if (!selectedNightId) {
      setHeadline("");
      setContent("");
      setImageBlob("");
      setError("");
      setSuccess("");
      return;
    }
    const existing = overviews.find(o => o.movieNightId === selectedNightId);
    if (existing) {
      setHeadline(existing.title || "");
      setContent(existing.content || "");
      const hasRealPhoto = isAuthenticGatheringPhoto(existing.imageUrl);
      setImageBlob(hasRealPhoto ? existing.imageUrl : "");
      setError("");
      setSuccess("");
    } else {
      setHeadline("");
      setContent("");
      setImageBlob("");
      setError("");
      setSuccess("");
    }
  }, [selectedNightId, overviews]);

  const compressImage = (file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        if (!rawDataUrl) {
          reject(new Error("Empty image file"));
          return;
        }
        const img = new Image();
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxWidth || height > maxHeight) {
              if (width / maxWidth > height / maxHeight) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              } else {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(rawDataUrl);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            resolve(dataUrl);
          } catch (canvasErr) {
            resolve(rawDataUrl);
          }
        };
        img.onerror = () => {
          if (file.size < 10 * 1024 * 1024 && rawDataUrl) {
            resolve(rawDataUrl);
          } else {
            reject(new Error("Failed to load image"));
          }
        };
        img.src = rawDataUrl;
      };
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, etc.)");
      return;
    }

    // Support photos up to 25MB by auto-compressing them in browser canvas
    if (file.size > 25 * 1024 * 1024) {
      setError("Image is too large. Please select an image under 25MB.");
      return;
    }

    compressImage(file)
      .then((compressedBase64) => {
        setImageBlob(compressedBase64);
        setError("");
      })
      .catch((err) => {
        console.error("Compression error:", err);
        setError("Failed to process image. Please try another photo.");
      });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedNightId) {
      setError("Please select which movie night this recap belongs to.");
      return;
    }
    if (!headline.trim()) {
      setError("Please enter a compelling recap headline.");
      return;
    }
    if (!content.trim()) {
      setError("Please write the recap details.");
      return;
    }

    setLoading(true);
    try {
      await onPostOverview(selectedNightId, headline.trim(), content.trim(), imageBlob || "");
      setSuccess("Success! The Night Overview and gathering photo have been saved.");
    } catch (e: any) {
      setError(e.message || "Failed to post the overview. Try again!");
    } finally {
      setLoading(false);
    }
  };

  const existingOverview = overviews.find(o => o.movieNightId === selectedNightId);
  const isEditingExisting = !!existingOverview;

  if (!isAuthorized) {
    return (
      <div className="bg-zinc-950/20 border border-zinc-900 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4">
        <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto" />
        <h3 className="text-xl font-serif font-bold text-zinc-300">Administrative Dashboard</h3>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Only <strong className="text-zinc-400">Ash Macintosh</strong> and club administrators have access to draft, publish, and replace movie night overviews and friends photography. Please sign in as Ash or James to access this dashboard.
        </p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 sm:p-8 md:p-10 max-w-3xl mx-auto backdrop-blur-md"
    >
      <div className="flex items-center gap-3 border-b border-zinc-900 pb-5 mb-6">
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-serif text-zinc-100 font-bold">
            {isAuthorized && currentUser?.username?.toLowerCase() !== "ash" ? "Admin Recap & Photo Manager" : "Night Writer Dashboard"}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Logged in as {currentUser?.name || "Admin"} • Add, replace, or update session recaps & gathering photos
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Night selector */}
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Select Movie Night
          </label>
          <select
            value={selectedNightId}
            onChange={(e) => setSelectedNightId(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-850 text-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-amber-500 text-base md:text-sm font-sans"
          >
            <option value="">-- Choose a movie night to add or replace photo/recap --</option>
            {reviewableNights.map((night, idx) => {
              const ov = overviews.find(o => o.movieNightId === night.id);
              const hasPhoto = ov && isAuthenticGatheringPhoto(ov.imageUrl);
              const tag = ov 
                ? (hasPhoto ? "✓ Has Photo" : "⚠️ Needs Photo") 
                : "📝 Unwritten";
              return (
                <option key={night.id} value={night.id}>
                  Night #{idx + 1} ({new Date(night.date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}) - {night.selector} - "{night.movie?.title}" [{tag}]
                </option>
              );
            })}
          </select>
        </div>

        {isEditingExisting && (
          <div className="flex items-center justify-between p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <Edit className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Editing existing recap for <strong>{reviewableNights.find(n => n.id === selectedNightId)?.movie?.title}</strong>
              </span>
            </div>
            <span className="font-mono text-[10px] bg-amber-500/20 px-2.5 py-0.5 rounded text-amber-300 font-semibold shrink-0">
              {imageBlob ? "Photo Attached" : "Needs Photo"}
            </span>
          </div>
        )}

        {/* Recap Headline */}
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Recap Headline / Title
          </label>
          <input
            type="text"
            placeholder="e.g., Inception Night: Dream Layers & Popcorn Overload"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-850 text-zinc-100 rounded-xl px-4 py-3 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
          />
        </div>

        {/* Narrative recap */}
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Narrative Recap & Stories
          </label>
          <textarea
            rows={5}
            placeholder="How did the night go? Write a cozy or funny recap about the movie reactions, debates, food brought, who fell asleep, etc..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-850 text-zinc-100 rounded-xl px-4 py-3 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans leading-relaxed"
          />
        </div>

        {/* Drag and Drop Image selection */}
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Upload Friends Photo (Memory Image)
          </label>

          {imageBlob ? (
            // Uploaded preview with clear Replace Photo and Remove options
            <div className="relative border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900 group">
              <img src={imageBlob} alt="Preview" className="w-full max-h-72 object-cover" />
              <div className="p-4 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Gathering photo selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onClick={(e) => e.stopPropagation()}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Replace Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageBlob("")}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900/40 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Photo</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Drag Drop box
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={(e) => {
                if (e.target !== fileInputRef.current) {
                  fileInputRef.current?.click();
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px] bg-zinc-900/10 ${
                dragActive 
                  ? "border-amber-500 bg-amber-500/[0.03]" 
                  : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onClick={(e) => e.stopPropagation()}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <div className="p-3 bg-zinc-900 border border-zinc-850 text-zinc-400 rounded-xl mb-3 shadow-md">
                <Upload className="w-6 h-6 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-zinc-200">
                Drag and drop your friends photo here
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Or click to browse files from your computer (auto-compressed safely)
              </p>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                  <Camera className="w-3.5 h-3.5" />
                  + Select Gathering Photo
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-xl">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-600 text-zinc-950 font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {isEditingExisting ? "Saving Changes & Photo..." : "Publishing Overview..."}
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                {isEditingExisting ? "Save & Update Recap / Photo" : "Publish Movie Night Recap"}
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
