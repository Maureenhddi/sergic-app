import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'annonces',
    pathMatch: 'full'
  },
  {
    path: 'annonces',
    loadComponent: () => import('./features/announcements/announcements.component')
      .then(m => m.AnnouncementsComponent)
  },
  {
    path: 'annonces/:slug',
    loadComponent: () => import('./features/announcement-detail/announcement-detail.component')
      .then(m => m.AnnouncementDetailComponent)
  },
  {
    path: 'favoris',
    loadComponent: () => import('./features/favorites/favorites.component')
      .then(m => m.FavoritesComponent)
  },
  {
    path: 'cgu',
    loadComponent: () => import('./features/cgu/cgu.component')
      .then(m => m.CguComponent)
  },
  {
    path: '**',
    redirectTo: 'annonces'
  }
];
