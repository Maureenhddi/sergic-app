import { Injectable, signal } from '@angular/core';
import { Announcement, AnnouncementDetail } from '../models/announcement.model';

const CACHE_KEY_ACHAT = 'sergic_cache_achat';
const CACHE_KEY_LOCATION = 'sergic_cache_location';
const CACHE_KEY_VACANCE = 'sergic_cache_vacance';
const CACHE_KEY_DETAILS = 'sergic_cache_details';
const CACHE_KEY_FAVORITES = 'sergic_favorites'; // Same key used by FavoritesService
const CACHE_TIMESTAMP_KEY = 'sergic_cache_timestamp';
const CACHE_MAX_ITEMS = 10;
const IMAGE_BASE_URL = 'https://ad-sergic-middle-prod.itroom.fr/';

interface CachedData<T> {
  data: T;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineCacheService {
  readonly isOffline = signal(false); // Start as online, will be updated

  constructor() {
    // Check initial state - navigator.onLine can be unreliable in some dev environments
    // Only set offline if we're truly offline AND not in localhost dev
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // In localhost dev, assume online unless explicitly offline
    if (!isLocalhost && typeof navigator !== 'undefined') {
      this.isOffline.set(!navigator.onLine);
    }

    // Listen for online/offline events
    window.addEventListener('online', () => this.isOffline.set(false));
    window.addEventListener('offline', () => this.isOffline.set(true));
  }

  // Cache announcements by type (achat/location/vacance)
  cacheAnnouncements(announcements: Announcement[], contractType: 'achat' | 'location' | 'vacance'): void {
    const key = contractType === 'achat' ? CACHE_KEY_ACHAT : contractType === 'location' ? CACHE_KEY_LOCATION : CACHE_KEY_VACANCE;
    const toCache = announcements.slice(0, CACHE_MAX_ITEMS);

    this.saveToStorage(key, {
      data: toCache,
      timestamp: Date.now()
    });
  }

  // Get cached announcements
  getCachedAnnouncements(contractType: 'achat' | 'location' | 'vacance'): Announcement[] {
    const key = contractType === 'achat' ? CACHE_KEY_ACHAT : contractType === 'location' ? CACHE_KEY_LOCATION : CACHE_KEY_VACANCE;
    const cached = this.loadFromStorage<CachedData<Announcement[]>>(key);
    return cached?.data || [];
  }

  // Get all cached announcements (achat + location + vacance + favorites)
  getAllCachedAnnouncements(): Announcement[] {
    const achat = this.getCachedAnnouncements('achat');
    const location = this.getCachedAnnouncements('location');
    const vacance = this.getCachedAnnouncements('vacance');
    const favorites = this.getCachedFavorites();

    // Merge without duplicates (by reference)
    const allRefs = new Set<string>();
    const result: Announcement[] = [];

    [...achat, ...location, ...vacance, ...favorites].forEach(ann => {
      if (!allRefs.has(ann.reference)) {
        allRefs.add(ann.reference);
        result.push(ann);
      }
    });

    return result;
  }

  // Get favorites directly from localStorage (to avoid circular dependency)
  private getCachedFavorites(): Announcement[] {
    try {
      const stored = localStorage.getItem(CACHE_KEY_FAVORITES);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // Cache announcement detail
  cacheAnnouncementDetail(detail: AnnouncementDetail): void {
    const cached = this.loadFromStorage<CachedData<Record<string, AnnouncementDetail>>>(CACHE_KEY_DETAILS) || {
      data: {},
      timestamp: Date.now()
    };

    cached.data[detail.slug] = detail;
    cached.timestamp = Date.now();

    // Keep only last 30 details to manage storage
    const slugs = Object.keys(cached.data);
    if (slugs.length > 30) {
      const toRemove = slugs.slice(0, slugs.length - 30);
      toRemove.forEach(slug => delete cached.data[slug]);
    }

    this.saveToStorage(CACHE_KEY_DETAILS, cached);
  }

  // Get cached announcement detail
  getCachedAnnouncementDetail(slug: string): AnnouncementDetail | null {
    const cached = this.loadFromStorage<CachedData<Record<string, AnnouncementDetail>>>(CACHE_KEY_DETAILS);
    return cached?.data?.[slug] || null;
  }

  // Cache favorites details (call this when favorites change)
  cacheFavoritesDetails(): void {
    // Favorites are already stored by FavoritesService
    // This method can be used to trigger detail caching
  }

  // Check if we have cached data
  hasCachedData(): boolean {
    const achat = this.getCachedAnnouncements('achat');
    const location = this.getCachedAnnouncements('location');
    return achat.length > 0 || location.length > 0;
  }

  // Get cache age in minutes
  getCacheAge(): number | null {
    const achatCached = this.loadFromStorage<CachedData<Announcement[]>>(CACHE_KEY_ACHAT);
    const locationCached = this.loadFromStorage<CachedData<Announcement[]>>(CACHE_KEY_LOCATION);

    const timestamp = achatCached?.timestamp || locationCached?.timestamp;
    if (!timestamp) return null;

    return Math.floor((Date.now() - timestamp) / (1000 * 60));
  }

  // Clear all cache
  clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY_ACHAT);
      localStorage.removeItem(CACHE_KEY_LOCATION);
      localStorage.removeItem(CACHE_KEY_DETAILS);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  }

  private loadFromStorage<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private saveToStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  // ==================== IMAGE URL HELPER ====================

  // Note: Image caching is disabled because the image server doesn't support CORS.
  // Images will show a placeholder when offline.

  // Get image URL - returns placeholder if offline
  getImageUrl(pictureUrl: string): string {
    if (!pictureUrl) return '';

    if (this.isOffline()) {
      // Return placeholder (simple gray image with camera icon)
      return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%23E5E7EB" width="200" height="200"/%3E%3Cpath fill="%239CA3AF" d="M100 60c-16.5 0-30 13.5-30 30s13.5 30 30 30 30-13.5 30-30-13.5-30-30-30zm0 50c-11 0-20-9-20-20s9-20 20-20 20 9 20 20-9 20-20 20z"/%3E%3Cpath stroke="%239CA3AF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" d="M50 150l40-40 25 25 25-25 40 40"/%3E%3C/svg%3E';
    }

    return pictureUrl.startsWith('http') ? pictureUrl : `${IMAGE_BASE_URL}${pictureUrl}`;
  }

  // No-op methods kept for API compatibility
  async cacheImage(_pictureUrl: string): Promise<void> {
    // Image caching disabled - CORS not supported by image server
  }

  async cacheAnnouncementImages(_announcements: Announcement[]): Promise<void> {
    // Image caching disabled - CORS not supported by image server
  }
}
