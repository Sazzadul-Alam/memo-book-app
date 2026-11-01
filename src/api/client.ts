// ── API HTTP Client (mobile) ──────────────────────────────────────────────────
// Ported from web lib/http.ts; uses SecureStore instead of sessionStorage.
// Sends x-client: mobile on every request so backend can return refresh_token.
// Supports transparent offline caching for all GET requests.

import { getToken, getRefreshToken, saveSession, clearSession } from '../utils/session';
import { saveToCache, getFromCache } from './cache';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.memobook.shop/api';

const USER_BASE = `${API_BASE}/user`;

// ── Shared headers ──────────────────────────────────────────────────────────

async function baseHeaders(includeAuth = false): Promise<Record<string, string>> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client': 'mobile',
  };
  if (includeAuth) {
    const token = await getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

// ── Token refresh logic ─────────────────────────────────────────────────────

let _refreshing: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;
      const res = await fetch(`${USER_BASE}/refresh-access-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client': 'mobile' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newAccess: string = data.access_token;
      const newRefresh: string = data.refresh_token ?? refreshToken;
      await saveSession(newAccess, newRefresh, {
        email: data.user?.email ?? '',
        name: data.user?.name ?? '',
        role: data.user?.role,
      });
      return newAccess;
    } catch {
      return null;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

function parseError(data: any): string {
  if (Array.isArray(data?.errors)) {
    return (data.errors as { message: string }[]).map((e) => e.message).join(', ');
  }
  return data?.message ?? 'Something went wrong';
}

// ── Core fetch ──────────────────────────────────────────────────────────────

async function doFetch<T>(
  url: string,
  init: RequestInit,
  authed = false,
  retry = true
): Promise<T> {
  if (authed) {
    const token = await getToken();
    (init.headers as Record<string, string>)['Authorization'] = token ? `Bearer ${token}` : '';
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (networkErr: any) {
    // If it's a GET request and network fails, check cache
    if (init.method === 'GET') {
      const cached = await getFromCache<T>(url);
      if (cached) {
        return cached.data;
      }
    }
    throw new Error('Network error. Please check your internet connection.');
  }

  // Handle 401 Unauthorized only on real response
  if (res.status === 401 && authed && retry) {
    const newToken = await attemptRefresh();
    if (newToken) {
      (init.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      return doFetch<T>(url, init, false, false);
    } else {
      await clearSession();
      throw new Error('SESSION_EXPIRED');
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(parseError(data));

  // If this was a successful GET, save to local cache
  if (init.method === 'GET') {
    saveToCache(url, data);
  }

  return data as T;
}

// ── Public API helpers ───────────────────────────────────────────────────────

export async function post<T>(path: string, body: unknown): Promise<T> {
  return doFetch<T>(
    `${USER_BASE}${path}`,
    {
      method: 'POST',
      headers: await baseHeaders(),
      body: JSON.stringify(body),
    },
    false
  );
}

export async function authedGet<T>(pathOrUrl: string): Promise<T> {
  const fullUrl = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_BASE}${pathOrUrl}`;
  try {
    return await doFetch<T>(
      fullUrl,
      { method: 'GET', headers: await baseHeaders(true) },
      true
    );
  } catch (err: any) {
    // Try returning cache even on general error if available
    const cached = await getFromCache<T>(fullUrl);
    if (cached) {
      return cached.data;
    }
    throw err;
  }
}

export async function authedPost<T>(
  basePath: string,
  path: string,
  body: unknown
): Promise<T> {
  return doFetch<T>(
    `${API_BASE}${basePath}${path}`,
    {
      method: 'POST',
      headers: await baseHeaders(true),
      body: JSON.stringify(body),
    },
    true
  );
}

export async function authedPut<T>(
  basePath: string,
  path: string,
  body: unknown
): Promise<T> {
  return doFetch<T>(
    `${API_BASE}${basePath}${path}`,
    {
      method: 'PUT',
      headers: await baseHeaders(true),
      body: JSON.stringify(body),
    },
    true
  );
}

export async function authedPatch<T>(
  basePath: string,
  path: string,
  body: unknown
): Promise<T> {
  return doFetch<T>(
    `${API_BASE}${basePath}${path}`,
    {
      method: 'PATCH',
      headers: await baseHeaders(true),
      body: JSON.stringify(body),
    },
    true
  );
}

export async function authedDelete<T>(basePath: string, path: string): Promise<T> {
  return doFetch<T>(
    `${API_BASE}${basePath}${path}`,
    { method: 'DELETE', headers: await baseHeaders(true) },
    true
  );
}

export async function authedFormPost<T>(
  basePath: string,
  path: string,
  formData: FormData
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { 'x-client': 'mobile' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return doFetch<T>(
    `${API_BASE}${basePath}${path}`,
    { method: 'POST', headers, body: formData },
    false
  );
}

export async function authedFormPut<T>(
  basePath: string,
  path: string,
  formData: FormData
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { 'x-client': 'mobile' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return doFetch<T>(
    `${API_BASE}${basePath}${path}`,
    { method: 'PUT', headers, body: formData },
    false
  );
}
