import { GoogleGenAI, Type } from "@google/genai";
import { MovieMetadata } from "../src/types.ts";

// Initialize Gemini SDK with custom user agent telemetry as instructed
const getGeminiClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined in environment variables. Gemini features might fail.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });
};

export async function fetchMovieMetadata(title: string, selector: string): Promise<MovieMetadata> {
  const tmdbApiKey = process.env.TMDB_API_KEY;

  if (tmdbApiKey) {
    console.log(`Using TMDb API Key to fetch metadata for: "${title}"`);
    try {
      // 1. Search for the movie
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}&language=en-US&page=1`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) {
        throw new Error(`TMDb search failed with status ${searchRes.status}`);
      }
      const searchData = (await searchRes.json()) as any;
      const movieResult = searchData.results?.[0];

      if (movieResult) {
        const movieId = movieResult.id;
        // 2. Fetch detailed movie metadata, including credits (for director), release_dates (for US rating), and videos (for trailers)
        const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}&append_to_response=credits,release_dates,videos&language=en-US`;
        const detailsRes = await fetch(detailsUrl);
        if (detailsRes.ok) {
          const movieDetails = (await detailsRes.json()) as any;

          // Find director
          const director = movieDetails.credits?.crew?.find((c: any) => c.job === "Director")?.name || "Unknown Director";

          // Genres
          const genre = movieDetails.genres?.map((g: any) => g.name).join(", ") || "Drama";

          // Release year
          const releaseDate = movieDetails.release_date;
          const year = releaseDate ? new Date(releaseDate).getFullYear() : new Date().getFullYear();

          // Runtime
          const runtime = movieDetails.runtime || 120;

          // Poster URL
          const posterPath = movieDetails.poster_path;
          const posterUrl = posterPath 
            ? `https://image.tmdb.org/t/p/w500${posterPath}` 
            : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80";

          // Content Rating (US certification)
          let rating = "PG-13";
          const usRelease = movieDetails.release_dates?.results?.find((r: any) => r.iso_3166_1 === "US");
          if (usRelease) {
            const certification = usRelease.release_dates?.find((d: any) => d.certification)?.certification;
            if (certification) {
              rating = certification;
            }
          }

          // YouTube Trailer
          let trailerUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent((movieDetails.title || title) + " " + year + " official trailer")}`;
          const trailerVideo = movieDetails.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer") 
            || movieDetails.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Teaser")
            || movieDetails.videos?.results?.find((v: any) => v.site === "YouTube");
          if (trailerVideo?.key) {
            trailerUrl = `https://www.youtube.com/watch?v=${trailerVideo.key}`;
          }

          return {
            title: movieDetails.title || title,
            year,
            director,
            genre,
            runtime,
            overview: movieDetails.overview || "No overview available.",
            rating,
            posterUrl,
            selectedBy: selector,
            trailerUrl
          };
        }
      }
    } catch (apiError) {
      console.error("Error calling TMDb API directly, falling back to Gemini Search Grounding:", apiError);
    }
  }

  // Fallback or default path: use Gemini with Google Search tool to search for TMDb info and return exact poster/metadata
  console.log(`Using Gemini with Google Search grounding to fetch TMDb details for: "${title}"`);
  const ai = getGeminiClient();
  
  const prompt = `Search for the movie "${title}" on TMDb (The Movie Database) or other official sources.
  Using your Google Search tool, find the official details of this movie.
  Retrieve:
  1. The official movie title.
  2. The release year of the movie.
  3. The primary director.
  4. Comma-separated list of genres (e.g. Action, Sci-Fi).
  5. Movie duration/runtime in minutes (integer, e.g. 148).
  6. A compelling 2-3 sentence synopsis/overview.
  7. Age rating (e.g. PG, PG-13, R, M, etc.).
  8. The official TMDb poster image URL. Official TMDb posters usually follow the format "https://image.tmdb.org/t/p/w500/..." or "https://image.tmdb.org/t/p/original/...". Find the poster path and construct a high-quality "https://image.tmdb.org/t/p/w500/<poster_path_hash>.jpg" URL. If you can't find the direct tmdb poster path, find a high-quality poster image URL for this specific movie.
  9. The official YouTube trailer video URL for this movie (e.g. "https://www.youtube.com/watch?v=dQw4w9WgXcQ"). If you cannot find a direct YouTube trailer link, generate a search results link on YouTube like "https://www.youtube.com/results?search_query=..." for the official movie trailer.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "The official movie title, capitalized correctly."
            },
            year: {
              type: Type.INTEGER,
              description: "The release year of the movie."
            },
            director: {
              type: Type.STRING,
              description: "The primary director of the movie."
            },
            genre: {
              type: Type.STRING,
              description: "Comma-separated list of genres (e.g. Action, Sci-Fi)."
            },
            runtime: {
              type: Type.INTEGER,
              description: "Movie duration in minutes."
            },
            overview: {
              type: Type.STRING,
              description: "A compelling 2-3 sentence synopsis of the movie."
            },
            rating: {
              type: Type.STRING,
              description: "Age rating (e.g. G, PG, PG-13, R, M, MA15+)."
            },
            posterUrl: {
              type: Type.STRING,
              description: "The official TMDb poster image URL starting with https://image.tmdb.org/t/p/w500/ or similar high-quality poster URL."
            },
            trailerUrl: {
              type: Type.STRING,
              description: "The official YouTube trailer link for the movie, or a high-quality search link on YouTube if not found."
            }
          },
          required: ["title", "year", "director", "genre", "runtime", "overview", "posterUrl", "trailerUrl"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response received from Gemini API");
    }

    const data = JSON.parse(text);
    
    // Fallback if poster is invalid or Unsplash fallback if everything fails
    const fallbackImages: Record<string, string> = {
      action: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80",
      scifi: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=800&q=80",
      drama: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80",
      horror: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80",
      comedy: "https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&w=800&q=80",
      default: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80"
    };

    const genreLower = (data.genre || "").toLowerCase();
    let finalPoster = data.posterUrl;
    if (!finalPoster || !finalPoster.startsWith("http")) {
      if (genreLower.includes("sci-fi") || genreLower.includes("science")) {
        finalPoster = fallbackImages.scifi;
      } else if (genreLower.includes("action") || genreLower.includes("adventure")) {
        finalPoster = fallbackImages.action;
      } else if (genreLower.includes("horror") || genreLower.includes("thriller")) {
        finalPoster = fallbackImages.horror;
      } else if (genreLower.includes("comedy")) {
        finalPoster = fallbackImages.comedy;
      } else if (genreLower.includes("drama") || genreLower.includes("romance")) {
        finalPoster = fallbackImages.drama;
      } else {
        finalPoster = fallbackImages.default;
      }
    }

    // Fallback trailer link if not returned or invalid
    const finalTrailerUrl = data.trailerUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent((data.title || title) + " " + (data.year || new Date().getFullYear()) + " official trailer")}`;

    return {
      title: data.title || title,
      year: Number(data.year) || new Date().getFullYear(),
      director: data.director || "Unknown Director",
      genre: data.genre || "Drama",
      runtime: Number(data.runtime) || 120,
      overview: data.overview || "No overview available.",
      rating: data.rating || "PG-13",
      posterUrl: finalPoster,
      selectedBy: selector,
      trailerUrl: finalTrailerUrl
    };
  } catch (error) {
    console.error("Error fetching metadata via Gemini:", error);
    // Return a functional fallback with a youtube search trailer link
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " official trailer")}`;
    return {
      title: title,
      year: new Date().getFullYear(),
      director: "Unknown Director",
      genre: "Action / Drama",
      runtime: 120,
      overview: "Details could not be pulled from online at the moment. Please update details if needed.",
      rating: "PG-13",
      posterUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80",
      selectedBy: selector,
      trailerUrl: searchUrl
    };
  }
}
