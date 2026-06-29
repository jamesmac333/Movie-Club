import React, { useState, useRef } from "react";
import { MovieNight, User } from "../types.ts";
import { BookOpen, Camera, Upload, AlertCircle, CheckCircle, Image as ImageIcon, Sparkles, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

interface OverviewFormProps {
  nights: MovieNight[];
  currentUser: User | null;
  onPostOverview: (movieNightId: string, title: string, content: string, imageUrl: string) => Promise<void>;
}

export default function OverviewForm({ nights, currentUser, onPostOverview }: OverviewFormProps) {
  const [selectedNightId, setSelectedNightId] = useState("");
  const [headline, setHeadline] = useState("");
  const [content, setContent] = useState("");
  const [imageBlob, setImageBlob] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security check: Only Ash Macintosh gets to use this form!
  const isAsh = currentUser?.username?.toLowerCase() === "ash" || currentUser?.isAsh === true;

  // List of movie nights that have a movie selected, ready for an overview
  const reviewableNights = nights.filter(n => n.movie !== null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, etc.)");
      return;
    }

    // Limit file size to 8MB in browser to keep transfers smooth
    if (file.size > 8 * 1024 * 1024) {
      setError("Image is too large. Please select an image under 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageBlob(reader.result as string);
      setError("");
    };
    reader.onerror = () => {
      setError("Failed to read image file. Try again.");
    };
    reader.readAsDataURL(file);
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
      setError("Please write the recap recap details.");
      return;
    }
    if (!imageBlob) {
      setError("Please upload a photo of the friends gathering to complete the memories overview.");
      return;
    }

    setLoading(true);
    try {
      await onPostOverview(selectedNightId, headline.trim(), content.trim(), imageBlob);
      setSuccess("Success! The Night Overview and friends photo has been published to the feed.");
      // Reset form fields
      setHeadline("");
      setContent("");
      setImageBlob("");
      setSelectedNightId("");
    } catch (e: any) {
      setError(e.message || "Failed to post the overview. Try again!");
    } finally {
      setLoading(false);
    }
  };

  if (!isAsh) {
    return (
      <div className="bg-zinc-950/20 border border-zinc-900 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4">
        <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto" />
        <h3 className="text-xl font-serif font-bold text-zinc-300">Administrative Dashboard</h3>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Only <strong className="text-zinc-400">Ash Macintosh</strong> has access to draft and publish the fortnightly movie night overviews and friends photography. Please sign in as Ash to access this dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 sm:p-8 md:p-10 max-w-3xl mx-auto backdrop-blur-md">
      <div className="flex items-center gap-3 border-b border-zinc-900 pb-5 mb-6">
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-serif text-zinc-100 font-bold">Night Writer Dashboard</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Logged in as Ash Macintosh • Post Memory Overview & Friends Photo</p>
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
            className="w-full bg-zinc-900 border border-zinc-850 text-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm font-sans"
          >
            <option value="">-- Choose a movie night to recap --</option>
            {reviewableNights.map((night, idx) => (
              <option key={night.id} value={night.id}>
                Night #{idx + 1} ({new Date(night.date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}) - Selector: {night.selector} - Film: "{night.movie?.title}"
              </option>
            ))}
          </select>
        </div>

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
            className="w-full bg-zinc-900 border border-zinc-850 text-zinc-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
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
            className="w-full bg-zinc-900 border border-zinc-850 text-zinc-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans leading-relaxed"
          />
        </div>

        {/* Drag and Drop Image selection */}
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Upload Friends Photo (Memory Image)
          </label>

          {imageBlob ? (
            // Uploaded preview
            <div className="relative border border-zinc-850 rounded-2xl overflow-hidden bg-zinc-900">
              <img src={imageBlob} alt="Preview" className="w-full max-h-64 object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setImageBlob("")}
                  className="bg-red-500 hover:bg-red-600 text-zinc-950 font-bold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer"
                >
                  Remove & Re-upload
                </button>
              </div>
              <div className="p-3 bg-zinc-950/80 text-[10px] text-zinc-400 font-mono flex items-center justify-between">
                <span>Image loaded successfully</span>
                <span className="text-emerald-400">Ready to publish</span>
              </div>
            </div>
          ) : (
            // Drag Drop box
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px] bg-zinc-900/10 ${
                dragActive 
                  ? "border-amber-500 bg-amber-500/[0.03]" 
                  : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
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
                Or click to browse files from your computer (under 8MB)
              </p>
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
                Publishing Overview...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Publish Movie Night Recap
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
