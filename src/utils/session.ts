// ── Secure Storage helpers (replaces sessionStorage from web) ──────────────
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ROLE: 'userRole',
  USER_EMAIL: 'userEmail',
  USER_NAME: 'userName',
} as const;

export interface JwtPayload {
  _id: string;
  email: string;
  role: 'admin' | 'customer';
  iat?: number;
  exp?: number;
}

/** Decode a JWT without verifying (client-side only). */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export async function saveSession(
  accessToken: string,
  refreshToken: string,
  user: { role?: 'admin' | 'customer'; email: string; name: string }
) {
  const payload = decodeJwt(accessToken);
  const role = payload?.role ?? user.role ?? 'customer';
  await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
  await SecureStore.setItemAsync(KEYS.USER_ROLE, role);
  await SecureStore.setItemAsync(KEYS.USER_EMAIL, user.email);
  await SecureStore.setItemAsync(KEYS.USER_NAME, user.name);
}

export async function clearSession() {
  await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)));
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
}

export async function getRole(): Promise<'admin' | 'customer'> {
  return ((await SecureStore.getItemAsync(KEYS.USER_ROLE)) as 'admin' | 'customer') ?? 'customer';
}

export async function getUserName(): Promise<string> {
  return (await SecureStore.getItemAsync(KEYS.USER_NAME)) ?? '';
}

export async function getUserEmail(): Promise<string> {
  return (await SecureStore.getItemAsync(KEYS.USER_EMAIL)) ?? '';
}

