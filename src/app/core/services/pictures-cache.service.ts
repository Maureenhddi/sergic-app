import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, shareReplay, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AnnouncementDetail } from '../models/announcement.model';

@Injectable({
  providedIn: 'root'
})
export class PicturesCacheService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<string[]>>();

  getPictures(slug: string): Observable<string[]> {
    // Retourner depuis le cache si déjà en cours ou chargé
    if (this.cache.has(slug)) {
      return this.cache.get(slug)!;
    }

    // Créer une nouvelle requête avec cache
    const request$ = this.http.get<AnnouncementDetail>(`${environment.apiUrl}/announcements/${slug}`).pipe(
      map(detail => {
        if (detail?.announcement_extras) {
          const picturesExtra = detail.announcement_extras.find(e => e.name === 'pictures');
          if (picturesExtra?.value) {
            try {
              return JSON.parse(picturesExtra.value) as string[];
            } catch {
              return [];
            }
          }
        }
        return [];
      }),
      catchError(() => of([])),
      shareReplay(1) // Partager le résultat entre les abonnés
    );

    this.cache.set(slug, request$);
    return request$;
  }

  // Précharger les pictures pour une liste d'annonces
  preloadPictures(slugs: string[]): void {
    slugs.forEach(slug => {
      if (!this.cache.has(slug)) {
        this.getPictures(slug).subscribe();
      }
    });
  }
}
