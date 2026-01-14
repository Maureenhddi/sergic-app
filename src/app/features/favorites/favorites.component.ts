import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FavoritesService } from '../../core/services/favorites.service';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { AnnouncementCardComponent } from '../../shared/components/announcement-card/announcement-card.component';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-favorites',
  imports: [RouterLink, HeaderComponent, AnnouncementCardComponent, BottomNavComponent],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FavoritesComponent {
  protected readonly favoritesService = inject(FavoritesService);

  protected clearFavorites(): void {
    this.favoritesService.clearFavorites();
  }
}
