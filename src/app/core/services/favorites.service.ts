import { Injectable, signal, computed, inject } from '@angular/core';
import { Announcement } from '../models/announcement.model';
import { AnnouncementService } from './announcement.service';
import { OfflineCacheService } from './offline-cache.service';

const FAVORITES_KEY = 'sergic_favorites';
const COMPARE_KEY = 'sergic_compare';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private readonly announcementService = inject(AnnouncementService);
  private readonly offlineCache = inject(OfflineCacheService);

  private readonly _favorites = signal<Announcement[]>(this.loadFromStorage(FAVORITES_KEY));
  private readonly _compareList = signal<Announcement[]>(this.loadFromStorage(COMPARE_KEY));

  readonly favorites = this._favorites.asReadonly();
  readonly compareList = this._compareList.asReadonly();

  readonly favoritesCount = computed(() => this._favorites().length);
  readonly compareCount = computed(() => this._compareList().length);

  readonly canAddToCompare = computed(() => this._compareList().length < 3);

  private loadFromStorage(key: string): Announcement[] {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(key: string, items: Announcement[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  // Favorites methods
  isFavorite(reference: string): boolean {
    return this._favorites().some(f => f.reference === reference);
  }

  toggleFavorite(announcement: Announcement): boolean {
    const current = this._favorites();
    const exists = current.some(f => f.reference === announcement.reference);

    if (exists) {
      const updated = current.filter(f => f.reference !== announcement.reference);
      this._favorites.set(updated);
      this.saveToStorage(FAVORITES_KEY, updated);
      return false;
    } else {
      const updated = [...current, announcement];
      this._favorites.set(updated);
      this.saveToStorage(FAVORITES_KEY, updated);
      this.enrichAnnouncementData(announcement, FAVORITES_KEY);
      // Cache image for offline use
      if (announcement.picture) {
        this.offlineCache.cacheImage(announcement.picture);
      }
      return true;
    }
  }

  addFavorite(announcement: Announcement): void {
    if (!this.isFavorite(announcement.reference)) {
      const updated = [...this._favorites(), announcement];
      this._favorites.set(updated);
      this.saveToStorage(FAVORITES_KEY, updated);
      this.enrichAnnouncementData(announcement, FAVORITES_KEY);
      // Cache image for offline use
      if (announcement.picture) {
        this.offlineCache.cacheImage(announcement.picture);
      }
    }
  }

  removeFavorite(reference: string): void {
    const updated = this._favorites().filter(f => f.reference !== reference);
    this._favorites.set(updated);
    this.saveToStorage(FAVORITES_KEY, updated);
  }

  clearFavorites(): void {
    this._favorites.set([]);
    this.saveToStorage(FAVORITES_KEY, []);
  }

  // Compare methods
  isInCompare(reference: string): boolean {
    return this._compareList().some(c => c.reference === reference);
  }

  toggleCompare(announcement: Announcement): boolean {
    const current = this._compareList();
    const exists = current.some(c => c.reference === announcement.reference);

    if (exists) {
      const updated = current.filter(c => c.reference !== announcement.reference);
      this._compareList.set(updated);
      this.saveToStorage(COMPARE_KEY, updated);
      return false;
    } else if (current.length < 3) {
      const updated = [...current, announcement];
      this._compareList.set(updated);
      this.saveToStorage(COMPARE_KEY, updated);
      this.enrichAnnouncementData(announcement, COMPARE_KEY);
      return true;
    }
    return false;
  }

  addToCompare(announcement: Announcement): boolean {
    if (this._compareList().length >= 3) return false;
    if (this.isInCompare(announcement.reference)) return false;

    const updated = [...this._compareList(), announcement];
    this._compareList.set(updated);
    this.saveToStorage(COMPARE_KEY, updated);
    this.enrichAnnouncementData(announcement, COMPARE_KEY);
    return true;
  }

  removeFromCompare(reference: string): void {
    const updated = this._compareList().filter(c => c.reference !== reference);
    this._compareList.set(updated);
    this.saveToStorage(COMPARE_KEY, updated);
  }

  clearCompare(): void {
    this._compareList.set([]);
    this.saveToStorage(COMPARE_KEY, []);
  }

  // Extract number of rooms from label_type (T1=1, T2=2, T3=3, etc.)
  private extractRoomsFromLabel(labelType: string): number | null {
    if (!labelType) return null;

    // Match T1, T2, T3, T4, T5, etc.
    const match = labelType.match(/T(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }

    // Studio = 1 pièce
    if (labelType.toLowerCase().includes('studio')) {
      return 1;
    }

    return null;
  }

  // Enrich announcement with title and number_of_beds from API
  private enrichAnnouncementData(announcement: Announcement, storageKey: string): void {
    // Skip if already enriched (has title)
    if (announcement.title) {
      return;
    }

    // Fetch from API to get title and number_of_beds
    this.announcementService.getBySlug(announcement.slug).subscribe({
      next: (detail) => {
        // Get rooms from label_type or API
        let rooms = announcement.number_of_beds;
        if (rooms === null || rooms === undefined) {
          rooms = this.extractRoomsFromLabel(announcement.label_type) ?? detail.number_of_beds;
        }

        this.updateAnnouncementData(announcement, {
          title: detail.title,
          number_of_beds: rooms
        }, storageKey);
      },
      error: (err) => {
        console.error('Failed to enrich announcement data:', err);
        // Fallback: at least try to extract rooms from label_type
        const roomsFromLabel = this.extractRoomsFromLabel(announcement.label_type);
        if (roomsFromLabel !== null) {
          this.updateAnnouncementData(announcement, { number_of_beds: roomsFromLabel }, storageKey);
        }
      }
    });
  }

  private updateAnnouncementData(
    announcement: Announcement,
    data: { title?: string; number_of_beds?: number | null },
    storageKey: string
  ): void {
    const enrichedAnnouncement: Announcement = {
      ...announcement,
      ...data
    };

    if (storageKey === FAVORITES_KEY) {
      const current = this._favorites();
      const updated = current.map(f =>
        f.reference === announcement.reference ? enrichedAnnouncement : f
      );
      this._favorites.set(updated);
      this.saveToStorage(FAVORITES_KEY, updated);
    } else if (storageKey === COMPARE_KEY) {
      const current = this._compareList();
      const updated = current.map(c =>
        c.reference === announcement.reference ? enrichedAnnouncement : c
      );
      this._compareList.set(updated);
      this.saveToStorage(COMPARE_KEY, updated);
    }
  }
}
