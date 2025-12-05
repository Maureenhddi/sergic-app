import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AnnouncementResponse, AnnouncementDetail } from '../models/announcement.model';

export interface AnnouncementFilters {
  contract_type?: 'achat' | 'location' | null;
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
  private readonly apiUrl = `${environment.apiUrl}/announcements/`;

  getAll(filters?: AnnouncementFilters): Observable<AnnouncementResponse> {
    // Si pas de contract_type spécifié, récupérer achat ET location
    if (!filters?.contract_type) {
      return this.getAllCombined(filters);
    }

    return this.fetchWithFilters(filters);
  }

  private getAllCombined(filters?: AnnouncementFilters): Observable<AnnouncementResponse> {
    const achatFilters = { ...filters, contract_type: 'achat' as const };
    const locationFilters = { ...filters, contract_type: 'location' as const };

    return forkJoin([
      this.fetchWithFilters(achatFilters),
      this.fetchWithFilters(locationFilters)
    ]).pipe(
      map(([achatResponse, locationResponse]) => {
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
      })
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

    return this.http.get<AnnouncementResponse>(this.apiUrl, { params });
  }

  getBySlug(slug: string): Observable<AnnouncementDetail> {
    return this.http.get<AnnouncementDetail>(`${this.apiUrl}${slug}`);
  }
}
