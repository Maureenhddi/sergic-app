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
    path: '**',
    redirectTo: 'annonces'
  }
];
