# CLAUDE.md - Sergic App

## Project Overview
Application mobile immobilière Sergic développée avec Angular 21 et Capacitor pour iOS.

## Tech Stack
- **Framework**: Angular 21 (standalone components, signals)
- **Mobile**: Capacitor 7 (iOS)
- **Styling**: SCSS avec variables CSS custom
- **Maps**: Leaflet
- **Language**: TypeScript

## Project Structure
```
src/app/
├── core/                    # Services et modèles partagés
│   ├── models/              # Interfaces TypeScript
│   └── services/            # Services (API, favoris, etc.)
├── features/                # Composants par fonctionnalité
│   ├── announcements/       # Liste des annonces + carte
│   ├── announcement-detail/ # Détail d'une annonce
│   ├── favorites/           # Favoris + comparateur
│   └── simulator/           # Simulateurs (prêt, frais notaire)
├── shared/                  # Composants réutilisables
│   └── components/
│       ├── header/          # Header avec navigation
│       └── search/          # Barre de recherche + filtres
└── app.routes.ts            # Configuration des routes
```

## Key Features
- **Recherche**: Filtres par type de contrat (achat/location), prix, surface, ville
- **Carte interactive**: Affichage des biens sur Leaflet avec clusters
- **Favoris**: Sauvegarde locale des biens favoris
- **Comparateur**: Comparaison de 2-3 biens côte à côte
- **Simulateur de prêt**: Calcul des mensualités avec amortissement
- **Frais de notaire**: Estimation des frais selon type de bien

## Commands
```bash
npm start          # Dev server (http://localhost:4200)
npm run build      # Build production
npx cap sync ios   # Sync avec iOS
npx cap open ios   # Ouvrir Xcode
```

## Design System
Variables CSS définies dans `styles.scss`:
- Couleurs: `--sergic-navy`, `--sergic-cyan`, `--gray-*`
- Espacements: `--space-1` à `--space-12`
- Border radius: `--radius-sm` à `--radius-full`
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`

## Patterns utilisés
- **Signals**: Utilisation des signaux Angular pour l'état réactif
- **Standalone components**: Tous les composants sont standalone
- **Glassmorphism**: Design avec `backdrop-filter: blur()` et backgrounds semi-transparents
- **CSS Grid animations**: Technique `grid-template-rows: 0fr/1fr` pour les animations d'expand/collapse

## API
Les annonces sont récupérées depuis l'API Sergic:
- Base URL: `https://sergic.com/api/`
- Endpoint annonces: `ads`

---

## Coding Conventions & Best Practices

### TypeScript
- Utiliser le strict type checking
- Préférer l'inférence de type quand le type est évident
- Éviter le type `any` ; utiliser `unknown` quand le type est incertain

### Angular Components
- Toujours utiliser des standalone components (pas de NgModules)
- NE PAS mettre `standalone: true` dans les décorateurs Angular (c'est le défaut depuis Angular v20+)
- Utiliser les signals pour la gestion d'état
- Implémenter le lazy loading pour les routes features
- NE PAS utiliser `@HostBinding` et `@HostListener`, utiliser l'objet `host` dans le décorateur `@Component` ou `@Directive`
- Utiliser `NgOptimizedImage` pour les images statiques
- Garder les composants petits avec une seule responsabilité
- Utiliser `input()` et `output()` au lieu des décorateurs
- Utiliser `computed()` pour l'état dérivé
- Définir `changeDetection: ChangeDetectionStrategy.OnPush` dans `@Component`
- Préférer les templates inline pour les petits composants
- Préférer les Reactive forms aux Template-driven forms
- NE PAS utiliser `ngClass`, utiliser les bindings `class` à la place
- NE PAS utiliser `ngStyle`, utiliser les bindings `style` à la place

### State Management
- Utiliser les signals pour l'état local des composants
- Utiliser `computed()` pour l'état dérivé
- Garder les transformations d'état pures et prévisibles
- NE PAS utiliser `mutate` sur les signals, utiliser `update` ou `set`

### Templates
- Garder les templates simples, éviter la logique complexe
- Utiliser le control flow natif (`@if`, `@for`, `@switch`) au lieu de `*ngIf`, `*ngFor`, `*ngSwitch`
- Utiliser le pipe async pour les observables
- Ne pas utiliser de fonctions fléchées dans les templates (non supportées)

### Services
- Concevoir les services autour d'une seule responsabilité
- Utiliser `providedIn: 'root'` pour les services singleton
- Utiliser la fonction `inject()` au lieu de l'injection par constructeur

### Accessibility (A11y)
- Doit passer tous les checks AXE
- Doit suivre les minimums WCAG AA (focus management, contraste couleurs, attributs ARIA)
