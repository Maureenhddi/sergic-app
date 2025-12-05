import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface SearchFilters {
  query: string;
  contractType: 'achat' | 'location' | null;
  placeType: string | null;
  priceMin: number | null;
  priceMax: number | null;
  surfaceMin: number | null;
  surfaceMax: number | null;
}

@Component({
  selector: 'app-search',
  imports: [FormsModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchComponent {
  readonly search = output<SearchFilters>();

  protected readonly query = signal('');
  protected readonly contractType = signal<'achat' | 'location' | null>(null);
  protected readonly placeType = signal<string | null>(null);
  protected readonly priceMin = signal<number | null>(null);
  protected readonly priceMax = signal<number | null>(null);
  protected readonly surfaceMin = signal<number | null>(null);
  protected readonly surfaceMax = signal<number | null>(null);
  protected readonly showFilters = signal(false);

  protected readonly contractTypes = [
    { value: null, label: 'Achat & Location' },
    { value: 'achat', label: 'Achat' },
    { value: 'location', label: 'Location' }
  ];

  protected readonly propertyTypes = [
    { value: null, label: 'Tous les biens' },
    { value: 'appartement', label: 'Appartement' },
    { value: 'studio', label: 'Studio' },
    { value: 'maison', label: 'Maison' },
    { value: 'Maison de ville', label: 'Maison de ville' },
    { value: 'Maison récente', label: 'Maison récente' },
    { value: 'Pavillon', label: 'Pavillon' },
    { value: 'Demeure', label: 'Demeure' },
    { value: 'terrain', label: 'Terrain' },
    { value: 'parking', label: 'Parking' },
    { value: 'Garage/box', label: 'Garage/Box' },
    { value: 'bureau', label: 'Bureau' },
    { value: 'local-commercial', label: 'Local commercial' },
    { value: 'immeuble', label: 'Immeuble' }
  ];

  protected readonly priceRanges = {
    achat: [
      { min: null, max: null, label: 'Tous les prix' },
      { min: null, max: 100000, label: 'Moins de 100 000 €' },
      { min: 100000, max: 200000, label: '100 000 - 200 000 €' },
      { min: 200000, max: 300000, label: '200 000 - 300 000 €' },
      { min: 300000, max: 500000, label: '300 000 - 500 000 €' },
      { min: 500000, max: null, label: 'Plus de 500 000 €' }
    ],
    location: [
      { min: null, max: null, label: 'Tous les prix' },
      { min: null, max: 500, label: 'Moins de 500 €/mois' },
      { min: 500, max: 800, label: '500 - 800 €/mois' },
      { min: 800, max: 1200, label: '800 - 1 200 €/mois' },
      { min: 1200, max: 2000, label: '1 200 - 2 000 €/mois' },
      { min: 2000, max: null, label: 'Plus de 2 000 €/mois' }
    ]
  };

  protected readonly surfaceRanges = [
    { min: null, max: null, label: 'Toutes surfaces' },
    { min: null, max: 30, label: 'Moins de 30 m²' },
    { min: 30, max: 50, label: '30 - 50 m²' },
    { min: 50, max: 80, label: '50 - 80 m²' },
    { min: 80, max: 120, label: '80 - 120 m²' },
    { min: 120, max: null, label: 'Plus de 120 m²' }
  ];

  protected get currentPriceRanges() {
    return this.contractType() === 'location'
      ? this.priceRanges.location
      : this.priceRanges.achat;
  }

  protected get hasActiveFilters(): boolean {
    return !!(
      this.contractType() ||
      this.placeType() ||
      this.priceMin() ||
      this.priceMax() ||
      this.surfaceMin() ||
      this.surfaceMax()
    );
  }

  protected onSubmit(): void {
    this.search.emit({
      query: this.query(),
      contractType: this.contractType(),
      placeType: this.placeType(),
      priceMin: this.priceMin(),
      priceMax: this.priceMax(),
      surfaceMin: this.surfaceMin(),
      surfaceMax: this.surfaceMax()
    });
  }

  protected toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  protected updateQuery(value: string): void {
    this.query.set(value);
  }

  protected updateContractType(value: string): void {
    this.contractType.set(value === '' ? null : value as 'achat' | 'location');
    // Reset price when switching contract type
    this.priceMin.set(null);
    this.priceMax.set(null);
    // Déclencher la recherche automatiquement
    this.onSubmit();
  }

  protected updatePlaceType(value: string): void {
    this.placeType.set(value === '' ? null : value);
  }

  protected updatePriceRange(value: string): void {
    if (!value) {
      this.priceMin.set(null);
      this.priceMax.set(null);
      return;
    }
    const [min, max] = value.split('-').map(v => v === 'null' ? null : Number(v));
    this.priceMin.set(min);
    this.priceMax.set(max);
  }

  protected updateSurfaceRange(value: string): void {
    if (!value) {
      this.surfaceMin.set(null);
      this.surfaceMax.set(null);
      return;
    }
    const [min, max] = value.split('-').map(v => v === 'null' ? null : Number(v));
    this.surfaceMin.set(min);
    this.surfaceMax.set(max);
  }

  protected clearFilters(): void {
    this.contractType.set(null);
    this.placeType.set(null);
    this.priceMin.set(null);
    this.priceMax.set(null);
    this.surfaceMin.set(null);
    this.surfaceMax.set(null);
    this.onSubmit();
  }

  protected getPriceRangeValue(): string {
    const min = this.priceMin();
    const max = this.priceMax();
    if (min === null && max === null) return '';
    return `${min}-${max}`;
  }

  protected getSurfaceRangeValue(): string {
    const min = this.surfaceMin();
    const max = this.surfaceMax();
    if (min === null && max === null) return '';
    return `${min}-${max}`;
  }
}
