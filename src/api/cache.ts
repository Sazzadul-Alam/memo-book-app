import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserEmail } from '../utils/session';

export interface CacheEntry<T> {
  data: T;
  savedAt: number; // timestamp ms
}

/**
 * Returns cache key formatted like `cache:<userIdentifier>:<path+query>`
 */
export async function getCacheKey(endpoint: string): Promise<string> {
  const email = (await getUserEmail()) || 'guest';
  const cleanKey = endpoint.replace(/[^a-zA-Z0-9_\-\/]/g, '_');
  return `cache:${email}:${cleanKey}`;
}

/**
 * Save data to local cache
 */
export async function saveToCache<T>(endpoint: string, data: T): Promise<void> {
  try {
    const key = await getCacheKey(endpoint);
    const entry: CacheEntry<T> = {
      data,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (err) {
    console.warn('Failed to save to offline cache:', err);
  }
}

/**
 * Retrieve cached data
 */
export async function getFromCache<T>(endpoint: string): Promise<CacheEntry<T> | null> {
  try {
    const key = await getCacheKey(endpoint);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

/**
 * Clear all cache for the current user (called on logout)
 */
export async function clearUserCache(): Promise<void> {
  try {
    const email = (await getUserEmail()) || 'guest';
    const prefix = `cache:${email}:`;
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter((k) => k.startsWith(prefix));
    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
    }
  } catch (err) {
    console.warn('Failed to clear user cache:', err);
  }
}

/**
 * Helper to format timestamp into human readable relative or clock time
 */
export function formatSavedAt(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
