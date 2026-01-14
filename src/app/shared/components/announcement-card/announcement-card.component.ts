import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Announcement } from '../../../core/models/announcement.model';
import { OfflineCacheService } from '../../../core/services/offline-cache.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { PicturesCacheService } from '../../../core/services/pictures-cache.service';

@Component({
  selector: 'app-announcement-card',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './announcement-card.component.html',
  styleUrl: './announcement-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementCardComponent {
  private readonly picturesCache = inject(PicturesCacheService);
  readonly announcement = input.required<Announcement>();
  readonly favoriteRemoved = output<string>();

  readonly currentIndex = signal(0);
  private touchStartX = 0;
  private touchEndX = 0;

  // Images chargées depuis l'API de détail
  private readonly loadedPictures = signal<string[]>([]);
  private lastLoadedSlug = '';

  readonly allImages = computed(() => {
    const ann = this.announcement();
    const loaded = this.loadedPictures();

    // Priorité aux pictures chargées dynamiquement (seulement si c'est pour cette annonce)
    if (loaded.length > 0 && this.lastLoadedSlug === ann.slug) {
      return loaded;
    }
    // Puis les pictures déjà enrichies
    if (ann.pictures && ann.pictures.length > 0) {
      return ann.pictures;
    }
    // Sinon l'image principale
    if (ann.picture) {
      return [ann.picture];
    }
    return [];
  });

  // Signal stable pour savoir si on a plusieurs images
  readonly hasMultipleImages = computed(() => {
    return this.allImages().length > 1;
  });

  constructor(
    private offlineCacheService: OfflineCacheService,
    public favoritesService: FavoritesService
  ) {
    // Surveiller les changements d'annonce et recharger les images
    effect(() => {
      const ann = this.announcement();
      // Si l'annonce change, recharger les images
      if (ann.slug !== this.lastLoadedSlug) {
        this.loadPicturesForAnnouncement(ann);
      }
    });

    // Réinitialiser l'index quand les images changent pour éviter un index invalide
    effect(() => {
      const images = this.allImages();
      if (this.currentIndex() >= images.length && images.length > 0) {
        this.currentIndex.set(0);
      }
    });
  }

  private loadPicturesForAnnouncement(ann: Announcement): void {
    this.lastLoadedSlug = ann.slug;
    this.currentIndex.set(0);
    this.loadedPictures.set([]);

    // Si déjà enrichi, ne pas recharger
    if (ann.pictures && ann.pictures.length > 1) {
      return;
    }

    this.picturesCache.getPictures(ann.slug).subscribe(pictures => {
      // Vérifier que c'est toujours la bonne annonce
      if (this.lastLoadedSlug === ann.slug && pictures.length > 0) {
        this.loadedPictures.set(pictures);
      }
    });
  }

  getImageUrl(picture: string): string {
    return this.offlineCacheService.getImageUrl(picture);
  }

  getContractLabel(contractType: string): string {
    if (contractType === 'location') return 'Location';
    if (contractType === 'vacance') return 'Vacances';
    return 'Vente';
  }

  toggleFavorite(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const ann = this.announcement();
    if (this.favoritesService.isFavorite(ann.reference)) {
      this.favoritesService.removeFavorite(ann.reference);
      this.favoriteRemoved.emit(ann.reference);
    } else {
      this.favoritesService.addFavorite(ann);
    }
  }

  nextImage(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const images = this.allImages();
    if (images.length > 1) {
      this.currentIndex.update(i => (i + 1) % images.length);
    }
  }

  prevImage(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const images = this.allImages();
    if (images.length > 1) {
      this.currentIndex.update(i => (i - 1 + images.length) % images.length);
    }
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchMove(event: TouchEvent): void {
    this.touchEndX = event.touches[0].clientX;
  }

  onTouchEnd(): void {
    const diff = this.touchStartX - this.touchEndX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        this.nextImage(new Event('swipe'));
      } else {
        this.prevImage(new Event('swipe'));
      }
    }

    this.touchStartX = 0;
    this.touchEndX = 0;
  }
}
