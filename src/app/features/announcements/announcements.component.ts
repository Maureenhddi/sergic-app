import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy, ElementRef, viewChild, effect } from '@angular/core';
import { AnnouncementService, AnnouncementFilters } from '../../core/services/announcement.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { OfflineCacheService } from '../../core/services/offline-cache.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { GeocodingService } from '../../core/services/geocoding.service';
import { Announcement } from '../../core/models/announcement.model';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { SearchComponent, SearchFilters } from '../../shared/components/search/search.component';
import { AnnouncementCardComponent } from '../../shared/components/announcement-card/announcement-card.component';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import * as L from 'leaflet';

type SortOption = 'recent' | 'price-asc' | 'price-desc' | 'surface';

@Component({
  selector: 'app-announcements',
  imports: [HeaderComponent, SearchComponent, AnnouncementCardComponent, BottomNavComponent],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementsComponent implements OnInit, OnDestroy {
  private readonly announcementService = inject(AnnouncementService);
  protected readonly favoritesService = inject(FavoritesService);
  protected readonly offlineCacheService = inject(OfflineCacheService);
  protected readonly filterStateService = inject(FilterStateService);
  private readonly geocodingService = inject(GeocodingService);

  protected readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');
  protected readonly scrollAnchor = viewChild<ElementRef<HTMLDivElement>>('scrollAnchor');

  protected readonly announcements = signal<Announcement[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly viewMode = signal<'list' | 'map'>('list');
  protected readonly currentFilters = signal<AnnouncementFilters>({});

  // Filtres avancés (côté client)
  protected readonly clientFilters = signal<{
    priceMin: number | null;
    priceMax: number | null;
    surfaceMin: number | null;
    surfaceMax: number | null;
    nbPiecesMin: number | null;
    nbPiecesMax: number | null;
    hasParking: boolean | null;
    hasBalcon: boolean | null;
    hasTerrace: boolean | null;
    hasGarden: boolean | null;
    hasCave: boolean | null;
    hasAscenseur: boolean | null;
    hasPiscine: boolean | null;
    isMeuble: boolean | null;
    propertyCondition: 'neuf' | 'ancien' | 'renove' | null;
  }>({
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

  // Pagination par scroll infini
  protected readonly pageSize = 12;
  protected readonly displayedCount = signal(12);
  protected readonly loadingMore = signal(false);

  // Tri
  protected readonly sortBy = signal<SortOption>('recent');

  // Pull to refresh
  protected readonly isRefreshing = signal(false);
  private pullStartY = 0;
  private isPulling = false;

  // Géolocalisation
  protected readonly userLocation = signal<{ lat: number; lng: number } | null>(null);
  protected readonly searchRadius = signal<number>(10); // km
  protected readonly geoFilterEnabled = signal(false);
  protected readonly locatingUser = signal(false);

  // Centre de recherche géocodé (pour recherche par ville)
  protected readonly geocodedCenter = signal<{ lat: number; lng: number } | null>(null);

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private userMarker: L.Marker | null = null;
  private radiusCircle: L.Circle | null = null;
  private scrollObserver: IntersectionObserver | null = null;

  protected readonly filteredAnnouncements = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filters = this.clientFilters();
    const radius = this.searchRadius();
    const geocodedCenter = this.geocodedCenter();
    let list = this.announcements();

    // Filtre par texte (ville/code postal) avec rayon
    if (query) {
      // Si on a un centre géocodé via l'API, l'utiliser
      if (geocodedCenter) {
        list = list.filter(a => {
          if (!a.latitude || !a.longitude) return false;
          const distance = this.calculateDistance(
            geocodedCenter.lat, geocodedCenter.lng,
            a.latitude, a.longitude
          );
          return distance <= radius;
        });
      } else {
        // Fallback: filtrer par texte et utiliser la première annonce comme centre
        const matchingAnnouncements = list.filter(a =>
          a.city.toLowerCase().includes(query) ||
          a.zip_code.includes(query)
        );

        const firstWithCoords = matchingAnnouncements.find(a => a.latitude && a.longitude);
        if (firstWithCoords) {
          const searchCenter = { lat: firstWithCoords.latitude!, lng: firstWithCoords.longitude! };
          list = list.filter(a => {
            if (!a.latitude || !a.longitude) return false;
            const distance = this.calculateDistance(
              searchCenter.lat, searchCenter.lng,
              a.latitude, a.longitude
            );
            return distance <= radius;
          });
        } else {
          // Pas de coordonnées trouvées, filtrer par texte classique
          list = matchingAnnouncements;
        }
      }
    }

    // Filtre par prix (côté client en backup si l'API ne filtre pas)
    if (filters.priceMin !== null || filters.priceMax !== null) {
      list = list.filter(a => {
        const price = a.price;
        if (filters.priceMin !== null && price < filters.priceMin) return false;
        if (filters.priceMax !== null && price > filters.priceMax) return false;
        return true;
      });
    }

    // Filtre par surface (côté client en backup si l'API ne filtre pas)
    if (filters.surfaceMin !== null || filters.surfaceMax !== null) {
      list = list.filter(a => {
        const surface = a.square_meter;
        if (filters.surfaceMin !== null && surface < filters.surfaceMin) return false;
        if (filters.surfaceMax !== null && surface > filters.surfaceMax) return false;
        return true;
      });
    }

    // Filtre par nombre de pièces
    if (filters.nbPiecesMin !== null || filters.nbPiecesMax !== null) {
      list = list.filter(a => {
        // number_of_beds représente le nombre de pièces dans l'API
        const pieces = a.number_of_beds;
        // Si pas de données de pièces, on garde l'annonce (ne pas exclure par défaut)
        if (pieces === null || pieces === undefined) return true;
        if (filters.nbPiecesMin !== null && pieces < filters.nbPiecesMin) return false;
        // nbPiecesMax peut être null pour "5 pièces et +"
        if (filters.nbPiecesMax !== null && pieces > filters.nbPiecesMax) return false;
        return true;
      });
    }

    // Note: Les filtres par équipements (parking, balcon, terrasse, etc.)
    // ne peuvent pas fonctionner car ces données ne sont disponibles
    // que dans les détails de l'annonce (announcement_extras), pas dans la liste.
    // Ces filtres sont gardés dans l'interface pour une future implémentation
    // côté API.

    // Filtre par géolocalisation (position utilisateur)
    const userLoc = this.userLocation();
    const geoEnabled = this.geoFilterEnabled();

    if (geoEnabled && userLoc) {
      list = list.filter(a => {
        if (!a.latitude || !a.longitude) return false;
        const distance = this.calculateDistance(
          userLoc.lat, userLoc.lng,
          a.latitude, a.longitude
        );
        return distance <= radius;
      });
    }

    // Tri
    const sort = this.sortBy();
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'surface':
          return b.square_meter - a.square_meter;
        case 'recent':
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

    return list;
  });

  protected readonly resultsCount = computed(() => this.filteredAnnouncements().length);

  // Annonces visibles (paginées)
  protected readonly visibleAnnouncements = computed(() => {
    return this.filteredAnnouncements().slice(0, this.displayedCount());
  });

  protected readonly hasMore = computed(() => {
    return this.displayedCount() < this.filteredAnnouncements().length;
  });

  private mapUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Watch for map container changes (when switching to map view)
    effect(() => {
      const container = this.mapContainer();
      if (container) {
        // Container just appeared, reset map reference and init
        this.map = null;
        this.markersLayer = null;
        this.scheduleMapUpdate();
      }
    });

    // Watch for data/filter changes to update map markers
    effect(() => {
      const mode = this.viewMode();
      const announcements = this.filteredAnnouncements();
      const geoEnabled = this.geoFilterEnabled();
      const userLoc = this.userLocation();
      const radius = this.searchRadius();
      // Track these dependencies to trigger map update
      void announcements;
      void geoEnabled;
      void userLoc;
      void radius;

      if (mode === 'map' && this.map) {
        // Map already exists, just update markers (debounced)
        this.scheduleMapUpdate();
      }
    });

    // Watch for scroll anchor to setup IntersectionObserver
    effect(() => {
      const anchor = this.scrollAnchor();
      if (anchor) {
        this.setupScrollObserver(anchor.nativeElement);
      }
    });
  }

  // Debounced map update to prevent multiple rapid calls
  private scheduleMapUpdate(): void {
    if (this.mapUpdateTimeout) {
      clearTimeout(this.mapUpdateTimeout);
    }
    this.mapUpdateTimeout = setTimeout(() => {
      this.initOrUpdateMap();
      this.mapUpdateTimeout = null;
    }, 150);
  }

  ngOnInit(): void {
    // Restaurer l'état persisté
    const savedFilters = this.filterStateService.filters();
    this.searchQuery.set(savedFilters.query);
    this.sortBy.set(this.filterStateService.sortBy());
    this.viewMode.set(this.filterStateService.viewMode());
    this.displayedCount.set(this.filterStateService.displayedCount());

    // Restaurer l'état de géolocalisation
    this.geoFilterEnabled.set(this.filterStateService.geoEnabled());
    this.userLocation.set(this.filterStateService.userLocation());
    this.searchRadius.set(this.filterStateService.searchRadius());

    // Restaurer les filtres côté client
    this.clientFilters.set({
      priceMin: savedFilters.priceMin,
      priceMax: savedFilters.priceMax,
      surfaceMin: savedFilters.surfaceMin,
      surfaceMax: savedFilters.surfaceMax,
      nbPiecesMin: savedFilters.nbPiecesMin,
      nbPiecesMax: savedFilters.nbPiecesMax,
      hasParking: savedFilters.hasParking,
      hasBalcon: savedFilters.hasBalcon,
      hasTerrace: savedFilters.hasTerrace,
      hasGarden: savedFilters.hasGarden,
      hasCave: savedFilters.hasCave,
      hasAscenseur: savedFilters.hasAscenseur,
      hasPiscine: savedFilters.hasPiscine,
      isMeuble: savedFilters.isMeuble,
      propertyCondition: savedFilters.propertyCondition
    });

    // Construire les filtres API à partir des filtres sauvegardés
    const apiFilters: AnnouncementFilters = {
      contract_type: savedFilters.contractType,
      place_type: savedFilters.placeType || undefined,
      price_min: savedFilters.priceMin ?? undefined,
      price_max: savedFilters.priceMax ?? undefined,
      surface_min: savedFilters.surfaceMin ?? undefined,
      surface_max: savedFilters.surfaceMax ?? undefined
    };

    this.currentFilters.set(apiFilters);
    this.loadAnnouncements(apiFilters);

    // Restaurer la position de scroll après le chargement
    const savedScrollPosition = this.filterStateService.scrollPosition();
    if (savedScrollPosition > 0) {
      setTimeout(() => {
        window.scrollTo(0, savedScrollPosition);
      }, 100);
    }
  }

  ngOnDestroy(): void {
    // Sauvegarder l'état avant destruction
    this.filterStateService.updateScrollPosition(window.scrollY);
    this.filterStateService.updateDisplayedCount(this.displayedCount());
    this.filterStateService.updateSortBy(this.sortBy());
    this.filterStateService.updateViewMode(this.viewMode());
    this.filterStateService.updateGeoState(
      this.geoFilterEnabled(),
      this.userLocation(),
      this.searchRadius()
    );

    if (this.mapUpdateTimeout) {
      clearTimeout(this.mapUpdateTimeout);
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.scrollObserver?.disconnect();
  }

  private setupScrollObserver(anchor: HTMLElement): void {
    this.scrollObserver?.disconnect();

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && this.hasMore() && !this.loadingMore()) {
          this.loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    this.scrollObserver.observe(anchor);
  }

  protected loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;

    this.loadingMore.set(true);

    // Simuler un petit délai pour l'UX
    setTimeout(() => {
      this.displayedCount.update(count => count + this.pageSize);
      this.loadingMore.set(false);
    }, 300);
  }

  private loadAnnouncements(filters?: AnnouncementFilters): void {
    this.loading.set(true);
    this.error.set(null);

    this.announcementService.getAll(filters).subscribe({
      next: (response) => {
        const announcements = response.announcements || [];
        this.announcements.set(announcements);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur API:', err);
        this.error.set('Impossible de charger les annonces');
        this.loading.set(false);
      }
    });
  }

  protected onSearch(filters: SearchFilters): void {
    this.searchQuery.set(filters.query);
    this.displayedCount.set(this.pageSize); // Reset pagination

    // Sauvegarder les filtres dans le service
    this.filterStateService.updateFilters(filters);
    this.filterStateService.updateScrollPosition(0); // Reset scroll position
    this.filterStateService.updateDisplayedCount(this.pageSize);

    // Géocoder la ville si une requête est présente
    const query = filters.query.trim();
    if (query && !this.geoFilterEnabled()) {
      // Appeler l'API de géocodage pour obtenir les coordonnées exactes
      this.geocodingService.geocode(query).subscribe(result => {
        if (result) {
          this.geocodedCenter.set({ lat: result.lat, lng: result.lng });
        } else {
          this.geocodedCenter.set(null);
        }
      });
    } else {
      this.geocodedCenter.set(null);
    }

    // Construire les filtres API
    const apiFilters: AnnouncementFilters = {
      contract_type: filters.contractType,
      place_type: filters.placeType,
      price_min: filters.priceMin,
      price_max: filters.priceMax,
      surface_min: filters.surfaceMin,
      surface_max: filters.surfaceMax
    };

    // Mettre à jour les filtres côté client
    this.clientFilters.set({
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      surfaceMin: filters.surfaceMin,
      surfaceMax: filters.surfaceMax,
      nbPiecesMin: filters.nbPiecesMin,
      nbPiecesMax: filters.nbPiecesMax,
      hasParking: filters.hasParking,
      hasBalcon: filters.hasBalcon,
      hasTerrace: filters.hasTerrace,
      hasGarden: filters.hasGarden,
      hasCave: filters.hasCave,
      hasAscenseur: filters.hasAscenseur,
      hasPiscine: filters.hasPiscine,
      isMeuble: filters.isMeuble,
      propertyCondition: filters.propertyCondition
    });

    this.currentFilters.set(apiFilters);
    this.loadAnnouncements(apiFilters);
  }

  protected getImageUrl(picture: string): string {
    return this.offlineCacheService.getImageUrl(picture);
  }

  protected getContractLabel(type: string): string {
    return type === 'achat' ? 'À vendre' : 'À louer';
  }

  protected toggleView(mode: 'list' | 'map'): void {
    this.viewMode.set(mode);
    this.triggerHaptic();
  }

  protected onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SortOption;
    this.sortBy.set(value);
    this.displayedCount.set(this.pageSize); // Reset pagination
    this.triggerHaptic();
  }

  protected async refreshAnnouncements(): Promise<void> {
    this.isRefreshing.set(true);
    await this.triggerHaptic();

    this.announcementService.getAll(this.currentFilters()).subscribe({
      next: (response) => {
        this.announcements.set(response.announcements || []);
        this.displayedCount.set(this.pageSize);
        this.isRefreshing.set(false);
      },
      error: () => {
        this.isRefreshing.set(false);
      }
    });
  }

  protected onPullStart(event: TouchEvent): void {
    if (window.scrollY === 0) {
      this.pullStartY = event.touches[0].clientY;
      this.isPulling = true;
    }
  }

  protected onPullMove(event: TouchEvent): void {
    if (!this.isPulling || this.isRefreshing()) return;

    const pullDistance = event.touches[0].clientY - this.pullStartY;
    if (pullDistance > 80 && window.scrollY === 0) {
      this.refreshAnnouncements();
      this.isPulling = false;
    }
  }

  protected onPullEnd(): void {
    this.isPulling = false;
  }

  private async triggerHaptic(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Haptics not available (web browser)
    }
  }

  protected locateUser(): void {
    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }

    this.locatingUser.set(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.userLocation.set({ lat: latitude, lng: longitude });
        this.geoFilterEnabled.set(true);
        this.locatingUser.set(false);

        // Vider la recherche textuelle quand géoloc active
        this.searchQuery.set('');
        this.filterStateService.updateFilters({
          ...this.filterStateService.filters(),
          query: ''
        });

        // Si on est en vue carte, centrer sur l'utilisateur
        if (this.viewMode() === 'map' && this.map) {
          this.map.setView([latitude, longitude], 12);
          this.updateUserMarker();
        }
      },
      (error) => {
        console.error('Erreur géolocalisation:', error);
        this.locatingUser.set(false);
        let message = 'Impossible de vous localiser';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Vous avez refusé la géolocalisation';
        }
        alert(message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  protected toggleGeoFilter(): void {
    if (!this.userLocation()) {
      this.locateUser();
    } else {
      const wasEnabled = this.geoFilterEnabled();
      this.geoFilterEnabled.update(v => !v);

      // Si on active la géoloc, vider la recherche textuelle
      if (!wasEnabled) {
        this.searchQuery.set('');
        this.filterStateService.updateFilters({
          ...this.filterStateService.filters(),
          query: ''
        });
      }

      if (this.viewMode() === 'map') {
        this.updateUserMarker();
      }
    }
  }

  protected updateRadius(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.onRadiusChange(parseInt(value, 10));
  }

  protected onRadiusChange(radius: number): void {
    this.searchRadius.set(radius);
    if (this.viewMode() === 'map') {
      this.updateUserMarker();
    }
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Formule de Haversine pour calculer la distance en km
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private updateUserMarker(): void {
    const userLoc = this.userLocation();
    const geoEnabled = this.geoFilterEnabled();

    // Supprimer les anciens marqueurs
    if (this.userMarker) {
      this.map?.removeLayer(this.userMarker);
      this.userMarker = null;
    }
    if (this.radiusCircle) {
      this.map?.removeLayer(this.radiusCircle);
      this.radiusCircle = null;
    }

    if (!userLoc || !geoEnabled || !this.map) return;

    // Marqueur utilisateur
    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div class="user-marker-pin">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="white" stroke-width="3"/>
          </svg>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    this.userMarker = L.marker([userLoc.lat, userLoc.lng], { icon: userIcon })
      .addTo(this.map)
      .bindPopup('Vous êtes ici');

    // Cercle de périmètre
    this.radiusCircle = L.circle([userLoc.lat, userLoc.lng], {
      radius: this.searchRadius() * 1000, // Convertir km en m
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 2
    }).addTo(this.map);
  }

  // Pre-encoded Base64 SVG markers (no runtime encoding needed)
  // Achat: Sergic Navy (#002a7b), Location: Sergic Cyan (#00b3ff)
  private static readonly MARKER_ACHAT_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDMyIDQwIj48cGF0aCBkPSJNMTYgMEM3LjE2IDAgMCA3LjE2IDAgMTZjMCAxMiAxNiAyNCAxNiAyNHMxNi0xMiAxNi0yNEMzMiA3LjE2IDI0Ljg0IDAgMTYgMHoiIGZpbGw9IiMwMDJhN2IiLz48Y2lyY2xlIGN4PSIxNiIgY3k9IjE0IiByPSI2IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==';
  private static readonly MARKER_LOCATION_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDMyIDQwIj48cGF0aCBkPSJNMTYgMEM3LjE2IDAgMCA3LjE2IDAgMTZjMCAxMiAxNiAyNCAxNiAyNHMxNi0xMiAxNi0yNEMzMiA3LjE2IDI0Ljg0IDAgMTYgMHoiIGZpbGw9IiMwMGIzZmYiLz48Y2lyY2xlIGN4PSIxNiIgY3k9IjE0IiByPSI2IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==';

  // Cached icon instances for better performance
  private markerIconAchat: L.Icon | null = null;
  private markerIconLocation: L.Icon | null = null;

  private getMarkerIcon(isRental: boolean): L.Icon {
    if (isRental) {
      if (!this.markerIconLocation) {
        this.markerIconLocation = L.icon({
          iconUrl: AnnouncementsComponent.MARKER_LOCATION_SVG,
          iconSize: [32, 40],
          iconAnchor: [16, 40],
          popupAnchor: [0, -40]
        });
      }
      return this.markerIconLocation;
    } else {
      if (!this.markerIconAchat) {
        this.markerIconAchat = L.icon({
          iconUrl: AnnouncementsComponent.MARKER_ACHAT_SVG,
          iconSize: [32, 40],
          iconAnchor: [16, 40],
          popupAnchor: [0, -40]
        });
      }
      return this.markerIconAchat;
    }
  }

  private initOrUpdateMap(): void {
    const container = this.mapContainer()?.nativeElement;
    if (!container) return;

    const announcements = this.filteredAnnouncements();

    // Initialize map if not exists
    if (!this.map) {
      this.map = L.map(container, {
        center: [46.603354, 1.888334], // France center
        zoom: 6,
        scrollWheelZoom: true
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(this.map);

      this.markersLayer = L.layerGroup().addTo(this.map);
    }

    // Clear existing markers
    this.markersLayer?.clearLayers();

    // Add markers for each announcement
    const bounds: L.LatLngBounds = L.latLngBounds([]);
    let hasValidCoords = false;

    announcements.forEach(ann => {
      if (ann.latitude && ann.longitude) {
        hasValidCoords = true;
        // Use marker with cached icon file (better performance than inline SVG)
        const marker = L.marker([ann.latitude, ann.longitude], {
          icon: this.getMarkerIcon(ann.contract_type === 'location')
        });

        const price = ann.price.toLocaleString('fr-FR');
        marker.bindPopup(`
          <div class="map-popup">
            <strong>${ann.label_type}</strong><br>
            <span class="popup-price">${price} €${ann.contract_type === 'location' ? '/mois' : ''}</span><br>
            <span>${ann.square_meter} m² - ${ann.city}</span><br>
            <a href="/annonces/${ann.slug}" class="popup-link">Voir l'annonce →</a>
          </div>
        `);

        marker.on('click', () => {
          marker.openPopup();
        });

        this.markersLayer?.addLayer(marker);
        bounds.extend([ann.latitude, ann.longitude]);
      }
    });

    // Fit map to markers ou centrer sur l'utilisateur
    const userLoc = this.userLocation();
    const geoEnabled = this.geoFilterEnabled();

    if (geoEnabled && userLoc) {
      // Centrer sur l'utilisateur avec le rayon
      this.map.setView([userLoc.lat, userLoc.lng], this.getZoomForRadius(this.searchRadius()));
      this.updateUserMarker();
    } else if (hasValidCoords && bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      // Clear user marker when geo filter is disabled
      this.clearUserMarker();
    } else {
      // No results and no geo filter - reset to France view
      this.map.setView([46.603354, 1.888334], 6);
      this.clearUserMarker();
    }

    // Fix map display
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  private clearUserMarker(): void {
    if (this.userMarker) {
      this.map?.removeLayer(this.userMarker);
      this.userMarker = null;
    }
    if (this.radiusCircle) {
      this.map?.removeLayer(this.radiusCircle);
      this.radiusCircle = null;
    }
  }

  private getZoomForRadius(radiusKm: number): number {
    // Approximation du zoom en fonction du rayon
    if (radiusKm <= 5) return 13;
    if (radiusKm <= 10) return 12;
    if (radiusKm <= 20) return 11;
    if (radiusKm <= 50) return 10;
    return 9;
  }

  protected async toggleFavorite(announcement: Announcement, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.favoritesService.toggleFavorite(announcement);
    await this.triggerHaptic();
  }

  protected async toggleCompare(announcement: Announcement, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const wasInList = this.favoritesService.isInCompare(announcement.reference);
    const result = this.favoritesService.toggleCompare(announcement);
    if (!result && !wasInList) {
      // Could not add (list full)
      alert('Vous pouvez comparer jusqu\'à 3 biens maximum');
    }
    await this.triggerHaptic();
  }
}
