import { Component, inject, ChangeDetectionStrategy, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FavoritesService } from '../../../core/services/favorites.service';
import { FilterStateService } from '../../../core/services/filter-state.service';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BottomNavComponent {
  private readonly router = inject(Router);
  private readonly filterStateService = inject(FilterStateService);
  protected readonly favoritesService = inject(FavoritesService);

  // Pour le toggle carte/liste (optionnel)
  readonly viewMode = input<'list' | 'map'>('list');
  readonly showViewToggle = input<boolean>(false);
  readonly viewToggle = output<'list' | 'map'>();

  toggleView(): void {
    const newMode = this.viewMode() === 'list' ? 'map' : 'list';
    this.viewToggle.emit(newMode);
  }

  goToMap(): void {
    this.filterStateService.updateViewMode('map');
    this.router.navigate(['/annonces']);
  }
}
