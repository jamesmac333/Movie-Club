// Session token issued by /api/auth/login, kept alongside the saved user. Both are kept in
// localStorage so members stay signed in after closing the browser or the Home Screen app
// (the token itself expires after 90 days).
const TOKEN_KEY = "movie_club_token";
const USER_KEY = "movie_club_user";

// Sign-ins from before this change were kept only for the browser tab: carry them over
for (const key of [TOKEN_KEY, USER_KEY]) {
  const old = sessionStorage.getItem(key);
  if (old && !localStorage.getItem(key)) localStorage.setItem(key, old);
  sessionStorage.removeItem(key);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getSavedUser(): string | null {
  return localStorage.getItem(USER_KEY);
}

export function saveUser(user: object): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
