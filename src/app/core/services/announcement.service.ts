import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, tap, of, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AnnouncementResponse, AnnouncementDetail, Announcement } from '../models/announcement.model';
import { OfflineCacheService } from './offline-cache.service';

export interface AnnouncementFilters {
  contract_type?: 'achat' | 'location' | 'vacance' | null;
  place_type?: string | null;
  city?: string | null;
  zip_code?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  surface_min?: number | null;
  surface_max?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class AnnouncementService {
  private readonly http = inject(HttpClient);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly apiUrl = `${environment.apiUrl}/announcements/`;
  private readonly holidaysApiUrl = `${environment.apiUrl}/announcements/holidays`;

  getAll(filters?: AnnouncementFilters): Observable<AnnouncementResponse> {
    // Si hors ligne, retourner le cache
    if (this.offlineCache.isOffline()) {
      return this.getOfflineData(filters);
    }

    // Si vacances, utiliser l'endpoint holidays
    if (filters?.contract_type === 'vacance') {
      return this.fetchHolidays(filters);
    }

    // Si pas de contract_type spécifié, récupérer achat ET location (pas vacances par défaut)
    if (!filters?.contract_type) {
      return this.getAllCombined(filters);
    }

    return this.fetchWithFilters(filters);
  }

  private getOfflineData(filters?: AnnouncementFilters): Observable<AnnouncementResponse> {
    let announcements: Announcement[] = [];

    if (filters?.contract_type) {
      announcements = this.offlineCache.getCachedAnnouncements(filters.contract_type);
    } else {
      announcements = this.offlineCache.getAllCachedAnnouncements();
    }

    // Apply local filters
    if (filters) {
      announcements = this.applyLocalFilters(announcements, filters);
    }

    return of({
      self: '',
      announcements,
      total_result: announcements.length,
      order: 'date'
    });
  }

  private applyLocalFilters(announcements: Announcement[], filters: AnnouncementFilters): Announcement[] {
    return announcements.filter(ann => {
      if (filters.place_type && filters.place_type !== 'all' && ann.place_type !== filters.place_type) {
        return false;
      }
      if (filters.city && !ann.city.toLowerCase().includes(filters.city.toLowerCase())) {
        return false;
      }
      if (filters.zip_code && !ann.zip_code.startsWith(filters.zip_code)) {
        return false;
      }
      if (filters.price_min && ann.price < filters.price_min) {
        return false;
      }
      if (filters.price_max && ann.price > filters.price_max) {
        return false;
      }
      if (filters.surface_min && ann.square_meter < filters.surface_min) {
        return false;
      }
      if (filters.surface_max && ann.square_meter > filters.surface_max) {
        return false;
      }
      return true;
    });
  }

  private getAllCombined(filters?: AnnouncementFilters): Observable<AnnouncementResponse> {
    const achatFilters = { ...filters, contract_type: 'achat' as const };
    const locationFilters = { ...filters, contract_type: 'location' as const };

    return forkJoin([
      this.fetchWithFilters(achatFilters),
      this.fetchWithFilters(locationFilters)
    ]).pipe(
      map(([achatResponse, locationResponse]) => {
        // Le cache est déjà fait dans fetchWithFilters
        const allAnnouncements = [
          ...(achatResponse.announcements || []),
          ...(locationResponse.announcements || [])
        ];
        return {
          self: achatResponse.self,
          announcements: allAnnouncements,
          total_result: allAnnouncements.length,
          order: achatResponse.order
        };
      }),
      catchError(() => this.getOfflineData(filters))
    );
  }

  private fetchWithFilters(filters?: AnnouncementFilters): Observable<AnnouncementResponse> {
    let params = new HttpParams();

    if (filters) {
      if (filters.contract_type) {
        params = params.set('contract_type', filters.contract_type);
      }
      if (filters.place_type && filters.place_type !== 'all') {
        params = params.set('place_type', filters.place_type);
      }
      if (filters.city) {
        params = params.set('city', filters.city);
      }
      if (filters.zip_code) {
        params = params.set('zip_code', filters.zip_code);
      }
      if (filters.price_min) {
        params = params.set('price_min', filters.price_min.toString());
      }
      if (filters.price_max) {
        params = params.set('price_max', filters.price_max.toString());
      }
      if (filters.surface_min) {
        params = params.set('surface_min', filters.surface_min.toString());
      }
      if (filters.surface_max) {
        params = params.set('surface_max', filters.surface_max.toString());
      }
    }

    return this.http.get<AnnouncementResponse>(this.apiUrl, { params }).pipe(
      tap(response => {
        // Toujours mettre en cache les résultats si on a un contract_type
        if (filters?.contract_type && response.announcements) {
          this.offlineCache.cacheAnnouncements(response.announcements, filters.contract_type);
          // Cache images in background
          this.offlineCache.cacheAnnouncementImages(response.announcements);
        }
      })
    );
  }

  private fetchHolidays(filters?: AnnouncementFilters): Observable<AnnouncementResponse> {
    let params = new HttpParams();

    if (filters) {
      if (filters.place_type && filters.place_type !== 'all') {
        params = params.set('place_type', filters.place_type);
      }
      if (filters.city) {
        params = params.set('city', filters.city);
      }
      if (filters.zip_code) {
        params = params.set('zip_code', filters.zip_code);
      }
      if (filters.price_min) {
        params = params.set('price_min', filters.price_min.toString());
      }
      if (filters.price_max) {
        params = params.set('price_max', filters.price_max.toString());
      }
      if (filters.surface_min) {
        params = params.set('surface_min', filters.surface_min.toString());
      }
      if (filters.surface_max) {
        params = params.set('surface_max', filters.surface_max.toString());
      }
    }

    return this.http.get<AnnouncementResponse>(this.holidaysApiUrl, { params }).pipe(
      tap(response => {
        if (response.announcements) {
          this.offlineCache.cacheAnnouncements(response.announcements, 'vacance');
          this.offlineCache.cacheAnnouncementImages(response.announcements);
        }
      })
    );
  }

  getBySlug(slug: string): Observable<AnnouncementDetail> {
    // Si hors ligne, retourner le cache
    if (this.offlineCache.isOffline()) {
      const cached = this.offlineCache.getCachedAnnouncementDetail(slug);
      if (cached) {
        return of(cached);
      }
      // Pas de cache disponible, throw error
      throw new Error('Annonce non disponible hors connexion');
    }

    return this.http.get<AnnouncementDetail>(`${this.apiUrl}${slug}`).pipe(
      tap(detail => {
        // Cache le detail
        this.offlineCache.cacheAnnouncementDetail(detail);
      }),
      catchError(() => {
        // Fallback to cache on error
        const cached = this.offlineCache.getCachedAnnouncementDetail(slug);
        if (cached) {
          return of(cached);
        }
        throw new Error('Annonce non disponible');
      })
    );
  }
}
