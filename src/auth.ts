// Session token issued by /api/auth/login, kept alongside the saved user
const TOKEN_KEY = "movie_club_token";
const USER_KEY = "movie_club_user";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

// Adds the session token to every /api request, and sends the user back to the
// login screen if the server says their session is no longer valid.
export function installAuthFetch(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    const isApi = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);
    const token = getToken();

    if (isApi && token) {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      init = { ...init, headers };
    }

    const response = await originalFetch(input, init);

    if (isApi && response.status === 401 && !url.includes("/api/auth/login")) {
      const data = await response.clone().json().catch(() => null);
      if (data?.code === "AUTH_REQUIRED") {
        clearSession();
        window.location.reload();
      }
    }

    return response;
  };
}
