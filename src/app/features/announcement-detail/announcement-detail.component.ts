import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy, ElementRef, viewChild, effect } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Location, DecimalPipe, LowerCasePipe } from '@angular/common';
import { AnnouncementService } from '../../core/services/announcement.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { OfflineCacheService } from '../../core/services/offline-cache.service';
import { AnnouncementDetail } from '../../core/models/announcement.model';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import * as L from 'leaflet';
import { getAgencyBySiret } from '../../core/data/agencies.data';

@Component({
  selector: 'app-announcement-detail',
  imports: [DecimalPipe, LowerCasePipe, RouterLink, HeaderComponent],
  templateUrl: './announcement-detail.component.html',
  styleUrl: './announcement-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly announcementService = inject(AnnouncementService);
  protected readonly favoritesService = inject(FavoritesService);
  private readonly offlineCache = inject(OfflineCacheService);

  protected readonly thumbnailsContainer = viewChild<ElementRef<HTMLDivElement>>('thumbnailsContainer');
  protected readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  protected readonly announcement = signal<AnnouncementDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly currentImageIndex = signal(0);
  protected readonly linkCopied = signal(false);
  protected readonly showContactForm = signal(false);
  protected readonly descriptionExpanded = signal(false);
  protected readonly showDpeInfo = signal(false);
  protected readonly showGesInfo = signal(false);

  private map: L.Map | null = null;
  private mapInitialized = false;

  // Swipe gesture
  private swipeStartX = 0;
  private swipeEndX = 0;
  private swiping = false;
  protected swipeOffset = signal(0); // Real-time drag offset in pixels

  constructor() {
    // Watch for announcement changes to initialize map
    effect(() => {
      const ann = this.announcement();
      if (ann && !this.mapInitialized) {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => this.initMap(), 100);
      }
    });
  }

  private createCustomIcon(): L.DivIcon {
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="marker-pin">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="white" stroke="white" stroke-width="2"/>
          </svg>
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 50],
      popupAnchor: [0, -50]
    });
  }

  private initMap(): void {
    const ann = this.announcement();
    const container = this.mapContainer()?.nativeElement;

    if (!ann || !container || this.mapInitialized) return;

    // Check if coordinates are valid
    if (!ann.latitude || !ann.longitude) return;

    this.mapInitialized = true;

    // Create map
    this.map = L.map(container, {
      center: [ann.latitude, ann.longitude],
      zoom: ann.is_exact_location ? 16 : 14,
      scrollWheelZoom: false
    });

    // Add CartoDB Positron tiles (clean, modern style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.map);

    // Add custom marker
    const marker = L.marker([ann.latitude, ann.longitude], {
      icon: this.createCustomIcon()
    }).addTo(this.map);

    // Add popup with property info
    marker.bindPopup(`
      <strong>${ann.title || ann.label_type}</strong><br>
      ${ann.zip_code} ${ann.city}
    `);

    // Invalidate size after a delay to fix display issues
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  // Computed values from announcement_extras
  protected readonly description = computed(() => this.getExtra('description'));
  protected readonly pictures = computed(() => {
    const pics = this.getExtra('pictures');
    if (!pics) return [];
    try {
      return JSON.parse(pics) as string[];
    } catch {
      return [];
    }
  });
  protected readonly nbPieces = computed(() => this.getExtra('nb_pieces'));
  protected readonly kitchen = computed(() => this.getExtra('kitchen'));
  protected readonly chauffageEnergie = computed(() => this.getExtra('chauffage_energie'));
  protected readonly typeChauffage = computed(() => this.getExtra('type_chauffage'));
  protected readonly etage = computed(() => this.getExtra('etage'));
  protected readonly nbEtages = computed(() => this.getExtra('nb_etages'));
  protected readonly nbSallesDeBains = computed(() => this.getExtra('nb_salles_de_bains'));
  protected readonly nbSallesEau = computed(() => this.getExtra('nb_salles_eau'));
  protected readonly eauChaude = computed(() => this.getExtra('eau_chaude'));
  protected readonly typeEauChaude = computed(() => this.getExtra('type_eau_chaude'));
  protected readonly copropriete = computed(() => this.getExtra('copropriete') === 'true');
  protected readonly chargesCopropriete = computed(() => {
    const val = this.getExtra('charges_copropriete');
    return val ? parseFloat(val) : null;
  });
  protected readonly alurNbLots = computed(() => this.getExtra('alur_nb_lots'));
  protected readonly depotGarantie = computed(() => {
    const val = this.getExtra('depot_garantie');
    return val ? parseFloat(val) : null;
  });
  protected readonly fraisAgence = computed(() => {
    const val = this.getExtra('frais_agence');
    return val ? parseFloat(val) : null;
  });
  protected readonly prixHorsHonoraires = computed(() => {
    const val = this.getExtra('prix_hors_honoraires');
    return val ? parseFloat(val) : null;
  });

  // Infos spécifiques location
  protected readonly loyer = computed(() => {
    const val = this.getExtra('loyer');
    return val ? parseFloat(val) : null;
  });
  protected readonly charges = computed(() => {
    const val = this.getExtra('charges');
    return val ? parseFloat(val) : null;
  });
  protected readonly loyerMensuelCC = computed(() => {
    const val = this.getExtra('loyer_mensuel_cc');
    return val ? parseFloat(val) : null;
  });
  protected readonly honorairesEtatDesLieux = computed(() => {
    const val = this.getExtra('honoraires_etat_des_lieux');
    return val ? parseFloat(val) : null;
  });
  protected readonly disponibleImmediatement = computed(() => this.getExtra('disponible_immediatement') === 'true');
  protected readonly dateDisponibilite = computed(() => this.getExtra('date_disponibilite'));
  protected readonly avecStationnement = computed(() => this.getExtra('avec_stationnement') === 'true');
  protected readonly surfaceBalcon = computed(() => {
    const val = this.getExtra('surface_balcon');
    return val ? parseFloat(val) : null;
  });
  protected readonly surfaceTerrasse = computed(() => {
    const val = this.getExtra('terrasse_surface');
    return val ? parseFloat(val) : null;
  });
  protected readonly surfaceJardin = computed(() => {
    const val = this.getExtra('surface_jardin');
    return val ? parseFloat(val) : null;
  });

  // Infos agence via SIRET
  protected readonly agencyInfo = computed(() => {
    const ann = this.announcement();
    return getAgencyBySiret(ann?.agency?.siret);
  });

  // Pour les locations : déterminer si les charges sont comprises
  protected readonly chargesLocation = computed(() => {
    const ann = this.announcement();
    if (!ann || ann.contract_type !== 'location') return null;

    const charges = this.charges();
    const loyer = this.loyer();

    // Si on a loyer et charges, on peut calculer
    if (loyer && charges) {
      // Le prix affiché est le loyer CC (charges comprises)
      return {
        included: true,
        amount: charges,
        loyerHC: loyer
      };
    }

    return null;
  });

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.loadAnnouncement(slug);
    } else {
      this.error.set('Annonce non trouvée');
      this.loading.set(false);
    }
  }

  private loadAnnouncement(slug: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.announcementService.getBySlug(slug).subscribe({
      next: (announcement) => {
        this.announcement.set(announcement);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur API:', err);
        this.error.set('Impossible de charger les détails de l\'annonce');
        this.loading.set(false);
      }
    });
  }

  private getExtra(name: string): string | null {
    const ann = this.announcement();
    if (!ann?.announcement_extras) return null;
    const extra = ann.announcement_extras.find(e => e.name === name);
    return extra?.value ?? null;
  }

  protected getImageUrl(picture: string): string {
    return this.offlineCache.getImageUrl(picture);
  }

  protected getContractLabel(type: string): string {
    return type === 'achat' ? 'À vendre' : 'À louer';
  }

  protected getRelativeDate(dateStr: string): string {
    const announcementDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - announcementDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return 'hier';
    if (diffDays < 7) return `il y a ${diffDays} jours`;
    if (diffDays < 14) return 'il y a 1 semaine';
    if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} semaines`;
    if (diffDays < 60) return 'il y a 1 mois';
    return `il y a ${Math.floor(diffDays / 30)} mois`;
  }

  protected async shareNative(): Promise<void> {
    const ann = this.announcement();
    if (!ann) return;

    const webUrl = this.getWebUrl();
    try {
      await Share.share({
        title: ann.title || ann.label_type,
        text: `${ann.title || ann.label_type} - ${ann.price.toLocaleString('fr-FR')} € - ${ann.city}`,
        url: webUrl,
        dialogTitle: 'Partager cette annonce'
      });
    } catch {
      // Fallback si Share n'est pas disponible (navigateur)
      this.copyLink();
    }
  }

  // Swipe handlers for gallery - fluid drag effect
  protected onSwipeStart(event: TouchEvent): void {
    this.swipeStartX = event.touches[0].clientX;
    this.swipeEndX = this.swipeStartX;
    this.swiping = true;
    this.swipeOffset.set(0);
  }

  protected onSwipeMove(event: TouchEvent): void {
    if (!this.swiping) return;

    this.swipeEndX = event.touches[0].clientX;
    const diff = this.swipeStartX - this.swipeEndX;

    // Apply drag offset for fluid effect
    // Reduce movement at boundaries
    const pics = this.pictures();
    const currentIdx = this.currentImageIndex();
    const isAtStart = currentIdx === 0 && diff < 0;
    const isAtEnd = currentIdx === pics.length - 1 && diff > 0;

    if (isAtStart || isAtEnd) {
      // Rubber band effect at edges
      this.swipeOffset.set(-diff * 0.3);
    } else {
      this.swipeOffset.set(-diff);
    }

    if (Math.abs(diff) > 10) {
      event.preventDefault();
    }
  }

  protected onSwipeEnd(): void {
    if (!this.swiping) return;

    const diff = this.swipeStartX - this.swipeEndX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        this.nextImage();
      } else {
        this.prevImage();
      }
    }

    this.swiping = false;
    this.swipeOffset.set(0);
  }

  protected getDpeClass(letter: string | null | undefined): string {
    if (!letter) return '';
    return `dpe-${letter.toLowerCase()}`;
  }

  protected getGesClass(letter: string | null | undefined): string {
    if (!letter) return '';
    return `ges-${letter.toLowerCase()}`;
  }

  protected nextImage(): void {
    const pics = this.pictures();
    if (pics.length === 0) return;
    const newIndex = (this.currentImageIndex() + 1) % pics.length;
    this.currentImageIndex.set(newIndex);
    this.scrollToThumbnail(newIndex);
  }

  protected prevImage(): void {
    const pics = this.pictures();
    if (pics.length === 0) return;
    const newIndex = (this.currentImageIndex() - 1 + pics.length) % pics.length;
    this.currentImageIndex.set(newIndex);
    this.scrollToThumbnail(newIndex);
  }

  protected selectImage(index: number): void {
    this.currentImageIndex.set(index);
    this.scrollToThumbnail(index);
  }

  private scrollToThumbnail(index: number): void {
    const container = this.thumbnailsContainer()?.nativeElement;
    if (!container) return;

    const thumbnails = container.querySelectorAll('.thumb-btn');
    const thumbnail = thumbnails[index] as HTMLElement;
    if (!thumbnail) return;

    const containerWidth = container.offsetWidth;
    const thumbLeft = thumbnail.offsetLeft;
    const thumbWidth = thumbnail.offsetWidth;

    // Center the thumbnail in the container
    const scrollPosition = thumbLeft - (containerWidth / 2) + (thumbWidth / 2);

    container.scrollTo({
      left: scrollPosition,
      behavior: 'smooth'
    });
  }

  // Contact form toggle
  protected toggleContactForm(): void {
    this.showContactForm.update(v => !v);
  }

  // Description toggle
  protected toggleDescription(): void {
    this.descriptionExpanded.update(v => !v);
  }

  // DPE/GES info toggles
  protected toggleDpeInfo(): void {
    this.showDpeInfo.update(v => !v);
    if (this.showDpeInfo()) this.showGesInfo.set(false);
  }

  protected toggleGesInfo(): void {
    this.showGesInfo.update(v => !v);
    if (this.showGesInfo()) this.showDpeInfo.set(false);
  }

  // Generate sergic.com URL for sharing
  private getWebUrl(): string {
    const ann = this.announcement();
    if (!ann) return 'https://www.sergic.com';

    // Use the slug directly - it already contains the correct format
    // Example slug: achat-2-pieces-38-33310-lormont-ouelg1033
    return `https://www.sergic.com/annonces-immobilieres/${ann.slug}`;
  }

  // Share functions
  protected shareWhatsApp(): void {
    const ann = this.announcement();
    if (!ann) return;
    const text = `Découvrez cette annonce : ${ann.title || ann.label_type} - ${ann.price.toLocaleString('fr-FR')} € - ${ann.city}`;
    const url = this.getWebUrl();
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
  }

  protected shareEmail(): void {
    const ann = this.announcement();
    if (!ann) return;
    const subject = `Annonce immobilière : ${ann.title || ann.label_type}`;
    const body = `Bonjour,\n\nJe vous partage cette annonce immobilière :\n\n${ann.title || ann.label_type}\nPrix : ${ann.price.toLocaleString('fr-FR')} €\nVille : ${ann.city}\n\nLien : ${this.getWebUrl()}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  protected copyLink(): void {
    const url = this.getWebUrl();
    navigator.clipboard.writeText(url).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  // Loan calculator (simple formula: M = P * [r(1+r)^n] / [(1+r)^n - 1])
  protected getMonthlyPayment(price: number): number {
    const rate = 0.035 / 12; // 3.5% annual rate, monthly
    const months = 20 * 12; // 20 years
    const principal = price * 0.9; // 90% financed (10% apport)

    if (rate === 0) return principal / months;

    const x = Math.pow(1 + rate, months);
    return (principal * rate * x) / (x - 1);
  }

  // Favorites & Compare methods
  protected async toggleFavorite(): Promise<void> {
    const ann = this.announcement();
    if (!ann) return;

    // AnnouncementDetail extends Announcement, so we can pass it directly
    this.favoritesService.toggleFavorite(ann);
    await this.triggerHaptic();
  }

  protected async toggleCompare(): Promise<void> {
    const ann = this.announcement();
    if (!ann) return;

    const wasInList = this.favoritesService.isInCompare(ann.reference);
    const result = this.favoritesService.toggleCompare(ann);
    if (!result && !wasInList) {
      alert('Vous pouvez comparer jusqu\'à 3 biens maximum');
    }
    await this.triggerHaptic();
  }

  private async triggerHaptic(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Haptics not available (browser)
    }
  }

  protected goBack(): void {
    this.location.back();
  }
}
