import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy, ElementRef, viewChild, effect } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe, TitleCasePipe, DatePipe, LowerCasePipe } from '@angular/common';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AnnouncementDetail } from '../../core/models/announcement.model';
import { HeaderComponent } from '../../shared/components/header/header.component';
import * as L from 'leaflet';

@Component({
  selector: 'app-announcement-detail',
  imports: [DecimalPipe, TitleCasePipe, DatePipe, LowerCasePipe, RouterLink, HeaderComponent],
  templateUrl: './announcement-detail.component.html',
  styleUrl: './announcement-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly announcementService = inject(AnnouncementService);

  protected readonly thumbnailsContainer = viewChild<ElementRef<HTMLDivElement>>('thumbnailsContainer');
  protected readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  protected readonly announcement = signal<AnnouncementDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly currentImageIndex = signal(0);
  protected readonly linkCopied = signal(false);
  protected readonly showContactForm = signal(false);

  private map: L.Map | null = null;
  private mapInitialized = false;

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
    return `https://ad-sergic-middle-prod.itroom.fr/${picture}`;
  }

  protected getContractLabel(type: string): string {
    return type === 'achat' ? 'À vendre' : 'À louer';
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

  // Share functions
  protected shareWhatsApp(): void {
    const ann = this.announcement();
    if (!ann) return;
    const text = `Découvrez cette annonce : ${ann.title || ann.label_type} - ${ann.price.toLocaleString('fr-FR')} € - ${ann.city}`;
    const url = window.location.href;
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
  }

  protected shareEmail(): void {
    const ann = this.announcement();
    if (!ann) return;
    const subject = `Annonce immobilière : ${ann.title || ann.label_type}`;
    const body = `Bonjour,\n\nJe vous partage cette annonce immobilière :\n\n${ann.title || ann.label_type}\nPrix : ${ann.price.toLocaleString('fr-FR')} €\nVille : ${ann.city}\n\nLien : ${window.location.href}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  protected copyLink(): void {
    navigator.clipboard.writeText(window.location.href).then(() => {
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
}
