import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

export interface GeocodingResult {
  lat: number;
  lng: number;
  label: string;
  city: string;
  postcode: string;
}

interface AddressApiResponse {
  features: Array<{
    geometry: {
      coordinates: [number, number]; // [lng, lat]
    };
    properties: {
      label: string;
      city: string;
      postcode: string;
      type: string;
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  private readonly API_URL = 'https://api-adresse.data.gouv.fr/search';
  private cache = new Map<string, GeocodingResult>();

  constructor(private http: HttpClient) {}

  /**
   * Géocode une ville ou code postal en coordonnées GPS
   * Utilise l'API Adresse du gouvernement français (gratuite, sans clé API)
   */
  geocode(query: string): Observable<GeocodingResult | null> {
    const normalizedQuery = query.trim().toLowerCase();

    // Vérifier le cache
    if (this.cache.has(normalizedQuery)) {
      return of(this.cache.get(normalizedQuery)!);
    }

    // Appeler l'API
    return this.http.get<AddressApiResponse>(this.API_URL, {
      params: {
        q: query,
        type: 'municipality', // Rechercher uniquement les communes
        limit: '1'
      }
    }).pipe(
      map(response => {
        if (response.features && response.features.length > 0) {
          const feature = response.features[0];
          const result: GeocodingResult = {
            lng: feature.geometry.coordinates[0],
            lat: feature.geometry.coordinates[1],
            label: feature.properties.label,
            city: feature.properties.city,
            postcode: feature.properties.postcode
          };

          // Mettre en cache
          this.cache.set(normalizedQuery, result);
          return result;
        }
        return null;
      }),
      catchError(error => {
        console.error('Erreur géocodage:', error);
        return of(null);
      })
    );
  }

  /**
   * Vide le cache de géocodage
   */
  clearCache(): void {
    this.cache.clear();
  }
}
