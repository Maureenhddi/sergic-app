import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy, ElementRef, viewChild, effect } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnnouncementService, AnnouncementFilters } from '../../core/services/announcement.service';
import { Announcement } from '../../core/models/announcement.model';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { SearchComponent, SearchFilters } from '../../shared/components/search/search.component';
import * as L from 'leaflet';

@Component({
  selector: 'app-announcements',
  imports: [DecimalPipe, TitleCasePipe, RouterLink, HeaderComponent, SearchComponent],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementsComponent implements OnInit, OnDestroy {
  private readonly announcementService = inject(AnnouncementService);

  protected readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');
  protected readonly scrollAnchor = viewChild<ElementRef<HTMLDivElement>>('scrollAnchor');

  protected readonly announcements = signal<Announcement[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly viewMode = signal<'list' | 'map'>('list');
  protected readonly currentFilters = signal<AnnouncementFilters>({});

  // Pagination par scroll infini
  protected readonly pageSize = 12;
  protected readonly displayedCount = signal(12);
  protected readonly loadingMore = signal(false);

  // Géolocalisation
  protected readonly userLocation = signal<{ lat: number; lng: number } | null>(null);
  protected readonly searchRadius = signal<number>(10); // km
  protected readonly geoFilterEnabled = signal(false);
  protected readonly locatingUser = signal(false);

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private userMarker: L.Marker | null = null;
  private radiusCircle: L.Circle | null = null;
  private scrollObserver: IntersectionObserver | null = null;

  protected readonly filteredAnnouncements = computed(() => {
    const query = this.searchQuery().toLowerCase();
    let list = this.announcements();

    // Filtre par texte
    if (query) {
      list = list.filter(a =>
        a.city.toLowerCase().includes(query) ||
        a.zip_code.includes(query) ||
        a.reference.toLowerCase().includes(query) ||
        a.place_type.toLowerCase().includes(query)
      );
    }

    // Filtre par géolocalisation
    const userLoc = this.userLocation();
    const radius = this.searchRadius();
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

  constructor() {
    // Watch for view mode or announcements changes to update map
    effect(() => {
      const mode = this.viewMode();
      const announcements = this.filteredAnnouncements();
      if (mode === 'map' && announcements.length > 0) {
        setTimeout(() => this.initOrUpdateMap(), 100);
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

  ngOnInit(): void {
    this.loadAnnouncements();
  }

  ngOnDestroy(): void {
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
        this.announcements.set(response.announcements || []);
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

    // Construire les filtres API
    const apiFilters: AnnouncementFilters = {
      contract_type: filters.contractType,
      place_type: filters.placeType,
      price_min: filters.priceMin,
      price_max: filters.priceMax,
      surface_min: filters.surfaceMin,
      surface_max: filters.surfaceMax
    };

    this.currentFilters.set(apiFilters);
    this.loadAnnouncements(apiFilters);
  }

  protected getImageUrl(picture: string): string {
    return `https://ad-sergic-middle-prod.itroom.fr/${picture}`;
  }

  protected getContractLabel(type: string): string {
    return type === 'achat' ? 'À vendre' : 'À louer';
  }

  protected toggleView(mode: 'list' | 'map'): void {
    this.viewMode.set(mode);
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
      this.geoFilterEnabled.update(v => !v);
      if (this.viewMode() === 'map') {
        this.updateUserMarker();
      }
    }
  }

  protected updateRadius(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.searchRadius.set(parseInt(value, 10));
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

  private createCustomIcon(isRental: boolean): L.DivIcon {
    const color = isRental ? '#10b981' : '#00b3ff';
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="marker-pin" style="--marker-color: ${color}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="white" stroke="white" stroke-width="2"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });
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
        const marker = L.marker([ann.latitude, ann.longitude], {
          icon: this.createCustomIcon(ann.contract_type === 'location')
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
    }

    // Fix map display
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  private getZoomForRadius(radiusKm: number): number {
    // Approximation du zoom en fonction du rayon
    if (radiusKm <= 5) return 13;
    if (radiusKm <= 10) return 12;
    if (radiusKm <= 20) return 11;
    if (radiusKm <= 50) return 10;
    return 9;
  }
}
