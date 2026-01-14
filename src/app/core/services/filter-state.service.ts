import { Injectable, signal } from '@angular/core';
import { SearchFilters } from '../../shared/components/search/search.component';

@Injectable({
  providedIn: 'root'
})
export class FilterStateService {
  // État persisté des filtres de recherche
  readonly filters = signal<SearchFilters>({
    query: '',
    contractType: 'achat',
    placeType: '',
    priceMin: null,
    priceMax: null,
    surfaceMin: null,
    surfaceMax: null,
    nbPiecesMin: null,
    nbPiecesMax: null,
    hasParking: null,
    hasBalcon: null,
    hasTerrace: null,
    hasGarden: null,
    hasCave: null,
    hasAscenseur: null,
    hasPiscine: null,
    isMeuble: null,
    propertyCondition: null
  });

  // Position de scroll pour revenir au même endroit
  readonly scrollPosition = signal(0);

  // Nombre d'éléments affichés (pagination)
  readonly displayedCount = signal(12);

  // Option de tri
  readonly sortBy = signal<'recent' | 'price-asc' | 'price-desc' | 'surface'>('recent');

  // Mode de vue (liste ou carte)
  readonly viewMode = signal<'list' | 'map'>('list');

  // État de géolocalisation
  readonly geoEnabled = signal(false);
  readonly userLocation = signal<{ lat: number; lng: number } | null>(null);
  readonly searchRadius = signal(10); // km

  updateFilters(filters: SearchFilters): void {
    this.filters.set(filters);
  }

  updateScrollPosition(position: number): void {
    this.scrollPosition.set(position);
  }

  updateDisplayedCount(count: number): void {
    this.displayedCount.set(count);
  }

  updateSortBy(sort: 'recent' | 'price-asc' | 'price-desc' | 'surface'): void {
    this.sortBy.set(sort);
  }

  updateViewMode(mode: 'list' | 'map'): void {
    this.viewMode.set(mode);
  }

  updateGeoState(enabled: boolean, location: { lat: number; lng: number } | null, radius: number): void {
    this.geoEnabled.set(enabled);
    this.userLocation.set(location);
    this.searchRadius.set(radius);
  }

  resetFilters(): void {
    this.filters.set({
      query: '',
      contractType: 'achat',
      placeType: '',
      priceMin: null,
      priceMax: null,
      surfaceMin: null,
      surfaceMax: null,
      nbPiecesMin: null,
      nbPiecesMax: null,
      hasParking: null,
      hasBalcon: null,
      hasTerrace: null,
      hasGarden: null,
      hasCave: null,
      hasAscenseur: null,
      hasPiscine: null,
      isMeuble: null,
      propertyCondition: null
    });
    this.scrollPosition.set(0);
    this.displayedCount.set(12);
    this.sortBy.set('recent');
  }
}
