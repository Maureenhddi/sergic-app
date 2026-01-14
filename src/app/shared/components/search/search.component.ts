import { Component, ChangeDetectionStrategy, output, signal, viewChild, ElementRef, inject, OnInit, input, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { FilterStateService } from '../../../core/services/filter-state.service';

export interface SearchFilters {
  query: string;
  contractType: 'achat' | 'location' | 'vacance' | null;
  placeType: string | null;
  priceMin: number | null;
  priceMax: number | null;
  surfaceMin: number | null;
  surfaceMax: number | null;
  // Filtres avancés
  nbPiecesMin: number | null;
  nbPiecesMax: number | null;
  hasParking: boolean | null;
  hasBalcon: boolean | null;
  hasTerrace: boolean | null;
  hasGarden: boolean | null;
  hasCave: boolean | null;
  hasAscenseur: boolean | null;
  hasPiscine: boolean | null;
  isMeuble: boolean | null;
  propertyCondition: 'neuf' | 'ancien' | 'renove' | null;
}

@Component({
  selector: 'app-search',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchComponent implements OnInit {
  // Inputs pour l'état de géolocalisation (contrôlé par le parent)
  readonly geoLocating = input(false);
  readonly geoActive = input(false);
  readonly searchRadius = input(10);

  // Outputs
  readonly search = output<SearchFilters>();
  readonly locateUser = output<void>();
  readonly radiusChange = output<number>();

  // Computed pour afficher le badge rayon
  protected readonly showRadiusBadge = computed(() => {
    return this.geoActive() || this.query().trim().length > 0;
  });

  private readonly filterStateService = inject(FilterStateService);
  private readonly filtersWrapper = viewChild<ElementRef<HTMLDivElement>>('filtersWrapper');

  protected readonly query = signal('');
  protected readonly contractType = signal<'achat' | 'location' | 'vacance' | null>('achat');
  protected readonly placeType = signal<string | null>(null);
  protected readonly priceMin = signal<number | null>(null);
  protected readonly priceMax = signal<number | null>(null);
  protected readonly surfaceMin = signal<number | null>(null);
  protected readonly surfaceMax = signal<number | null>(null);
  protected readonly showFilters = signal(false);

  // Filtres avancés
  protected readonly nbPiecesMin = signal<number | null>(null);
  protected readonly nbPiecesMax = signal<number | null>(null);
  protected readonly hasParking = signal<boolean | null>(null);
  protected readonly hasBalcon = signal<boolean | null>(null);
  protected readonly hasTerrace = signal<boolean | null>(null);
  protected readonly hasGarden = signal<boolean | null>(null);
  protected readonly hasCave = signal<boolean | null>(null);
  protected readonly hasAscenseur = signal<boolean | null>(null);
  protected readonly hasPiscine = signal<boolean | null>(null);
  protected readonly isMeuble = signal<boolean | null>(null);
  protected readonly propertyCondition = signal<'neuf' | 'ancien' | 'renove' | null>(null);

  ngOnInit(): void {
    // Restaurer les filtres depuis le service
    const savedFilters = this.filterStateService.filters();
    this.query.set(savedFilters.query);
    this.contractType.set(savedFilters.contractType);
    this.placeType.set(savedFilters.placeType);
    this.priceMin.set(savedFilters.priceMin);
    this.priceMax.set(savedFilters.priceMax);
    this.surfaceMin.set(savedFilters.surfaceMin);
    this.surfaceMax.set(savedFilters.surfaceMax);
    this.nbPiecesMin.set(savedFilters.nbPiecesMin);
    this.nbPiecesMax.set(savedFilters.nbPiecesMax);
    this.hasParking.set(savedFilters.hasParking);
    this.hasBalcon.set(savedFilters.hasBalcon);
    this.hasTerrace.set(savedFilters.hasTerrace);
    this.hasGarden.set(savedFilters.hasGarden);
    this.hasCave.set(savedFilters.hasCave);
    this.hasAscenseur.set(savedFilters.hasAscenseur);
    this.hasPiscine.set(savedFilters.hasPiscine);
    this.isMeuble.set(savedFilters.isMeuble);
    this.propertyCondition.set(savedFilters.propertyCondition);
  }

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
    ],
    vacance: [
      { min: null, max: null, label: 'Tous les prix' },
      { min: null, max: 50, label: 'Moins de 50 €/nuit' },
      { min: 50, max: 80, label: '50 - 80 €/nuit' },
      { min: 80, max: 120, label: '80 - 120 €/nuit' },
      { min: 120, max: 200, label: '120 - 200 €/nuit' },
      { min: 200, max: null, label: 'Plus de 200 €/nuit' }
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

  protected readonly piecesRanges = [
    { min: null, max: null, label: 'Toutes' },
    { min: 1, max: 1, label: '1 pièce' },
    { min: 2, max: 2, label: '2 pièces' },
    { min: 3, max: 3, label: '3 pièces' },
    { min: 4, max: 4, label: '4 pièces' },
    { min: 5, max: null, label: '5 pièces et +' }
  ];

  protected readonly conditionOptions = [
    { value: null, label: 'Tous' },
    { value: 'neuf', label: 'Neuf' },
    { value: 'ancien', label: 'Ancien' },
    { value: 'renove', label: 'Rénové' }
  ];

  protected get currentPriceRanges() {
    const type = this.contractType();
    if (type === 'location') return this.priceRanges.location;
    if (type === 'vacance') return this.priceRanges.vacance;
    return this.priceRanges.achat;
  }

  protected get hasActiveFilters(): boolean {
    return !!(
      this.placeType() || // Type de bien (sauf "Tous les biens" qui est null)
      this.priceMin() ||
      this.priceMax() ||
      this.surfaceMin() ||
      this.surfaceMax() ||
      this.nbPiecesMin() ||
      this.nbPiecesMax() ||
      this.hasParking() ||
      this.hasBalcon() ||
      this.hasTerrace() ||
      this.hasGarden() ||
      this.hasCave() ||
      this.hasAscenseur() ||
      this.hasPiscine() ||
      this.isMeuble() ||
      this.propertyCondition()
    );
  }

  protected get activeFiltersCount(): number {
    let count = 0;
    if (this.placeType()) count++; // Type de bien compte comme filtre
    if (this.priceMin() || this.priceMax()) count++;
    if (this.surfaceMin() || this.surfaceMax()) count++;
    if (this.nbPiecesMin() || this.nbPiecesMax()) count++;
    if (this.hasParking()) count++;
    if (this.hasBalcon()) count++;
    if (this.hasTerrace()) count++;
    if (this.hasGarden()) count++;
    if (this.hasCave()) count++;
    if (this.hasAscenseur()) count++;
    if (this.hasPiscine()) count++;
    if (this.isMeuble()) count++;
    if (this.propertyCondition()) count++;
    return count;
  }

  protected onSubmit(): void {
    const scrollY = window.scrollY;
    this.showFilters.set(false);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
    this.search.emit({
      query: this.query(),
      contractType: this.contractType(),
      placeType: this.placeType(),
      priceMin: this.priceMin(),
      priceMax: this.priceMax(),
      surfaceMin: this.surfaceMin(),
      surfaceMax: this.surfaceMax(),
      nbPiecesMin: this.nbPiecesMin(),
      nbPiecesMax: this.nbPiecesMax(),
      hasParking: this.hasParking(),
      hasBalcon: this.hasBalcon(),
      hasTerrace: this.hasTerrace(),
      hasGarden: this.hasGarden(),
      hasCave: this.hasCave(),
      hasAscenseur: this.hasAscenseur(),
      hasPiscine: this.hasPiscine(),
      isMeuble: this.isMeuble(),
      propertyCondition: this.propertyCondition()
    });
  }

  protected toggleFilters(event: Event): void {
    event.preventDefault();
    const scrollY = window.scrollY;
    this.showFilters.update(v => !v);
    // Empêcher le scroll auto du navigateur
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  }

  protected updateQuery(value: string): void {
    this.query.set(value);
  }

  protected updateContractType(value: string): void {
    this.contractType.set(value === '' ? null : value as 'achat' | 'location' | 'vacance');
    // Reset price when switching contract type
    this.priceMin.set(null);
    this.priceMax.set(null);
    // Déclencher la recherche automatiquement
    this.onSubmit();
  }

  protected updatePlaceType(value: string): void {
    this.placeType.set(value === '' ? null : value);
  }

  protected updatePriceMin(value: string | number): void {
    const numValue = typeof value === 'string' ? (value === '' ? null : Number(value)) : value;
    this.priceMin.set(numValue);
  }

  protected updatePriceMax(value: string | number): void {
    const numValue = typeof value === 'string' ? (value === '' ? null : Number(value)) : value;
    this.priceMax.set(numValue);
  }

  protected updateSurfaceMin(value: string | number): void {
    const numValue = typeof value === 'string' ? (value === '' ? null : Number(value)) : value;
    this.surfaceMin.set(numValue);
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
    // Ne pas reset contractType (Achat/Location) - ce n'est pas un filtre
    this.placeType.set(null); // Reset type de bien à "Tous les biens"
    this.priceMin.set(null);
    this.priceMax.set(null);
    this.surfaceMin.set(null);
    this.surfaceMax.set(null);
    this.nbPiecesMin.set(null);
    this.nbPiecesMax.set(null);
    this.hasParking.set(null);
    this.hasBalcon.set(null);
    this.hasTerrace.set(null);
    this.hasGarden.set(null);
    this.hasCave.set(null);
    this.hasAscenseur.set(null);
    this.hasPiscine.set(null);
    this.isMeuble.set(null);
    this.propertyCondition.set(null);
    this.onSubmit();
  }

  protected updatePiecesRange(value: string): void {
    if (!value) {
      this.nbPiecesMin.set(null);
      this.nbPiecesMax.set(null);
      return;
    }
    const [min, max] = value.split('-').map(v => v === 'null' ? null : Number(v));
    this.nbPiecesMin.set(min);
    this.nbPiecesMax.set(max);
  }

  protected getPiecesRangeValue(): string {
    const min = this.nbPiecesMin();
    const max = this.nbPiecesMax();
    if (min === null && max === null) return '';
    return `${min}-${max}`;
  }

  protected toggleFeature(feature: 'parking' | 'balcon' | 'terrace' | 'garden' | 'cave' | 'ascenseur' | 'piscine' | 'meuble'): void {
    switch (feature) {
      case 'parking':
        this.hasParking.update(v => v ? null : true);
        break;
      case 'balcon':
        this.hasBalcon.update(v => v ? null : true);
        break;
      case 'terrace':
        this.hasTerrace.update(v => v ? null : true);
        break;
      case 'garden':
        this.hasGarden.update(v => v ? null : true);
        break;
      case 'cave':
        this.hasCave.update(v => v ? null : true);
        break;
      case 'ascenseur':
        this.hasAscenseur.update(v => v ? null : true);
        break;
      case 'piscine':
        this.hasPiscine.update(v => v ? null : true);
        break;
      case 'meuble':
        this.isMeuble.update(v => v ? null : true);
        break;
    }
  }

  protected updateCondition(value: string): void {
    this.propertyCondition.set(value === '' ? null : value as 'neuf' | 'ancien' | 'renove');
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

  // Range slider methods
  protected getMaxPriceForRange(): number {
    const type = this.contractType();
    if (type === 'location') return 3000;
    if (type === 'vacance') return 500;
    return 1000000;
  }

  protected getPriceStep(): number {
    const type = this.contractType();
    if (type === 'location') return 50;
    if (type === 'vacance') return 10;
    return 10000;
  }

  protected getRangeLeftPercent(): number {
    const min = this.priceMin() ?? 0;
    const max = this.getMaxPriceForRange();
    return (min / max) * 100;
  }

  protected getRangeWidthPercent(): number {
    const minVal = this.priceMin() ?? 0;
    const maxVal = this.priceMax() ?? this.getMaxPriceForRange();
    const rangeMax = this.getMaxPriceForRange();
    return ((maxVal - minVal) / rangeMax) * 100;
  }

  protected updatePriceMinFromRange(value: number): void {
    const maxVal = this.priceMax() ?? this.getMaxPriceForRange();
    // S'assurer que min ne dépasse pas max
    if (value > maxVal) {
      value = maxVal;
    }
    this.priceMin.set(value === 0 ? null : value);
  }

  protected updatePriceMaxFromRange(value: number): void {
    const minVal = this.priceMin() ?? 0;
    // S'assurer que max ne soit pas inférieur à min
    if (value < minVal) {
      value = minVal;
    }
    const maxRange = this.getMaxPriceForRange();
    this.priceMax.set(value >= maxRange ? null : value);
  }

  protected formatPrice(price: number | null): string {
    if (price === null || price === 0) return '0 €';
    return price.toLocaleString('fr-FR') + ' €';
  }

  protected onLocateUser(): void {
    this.locateUser.emit();
  }

  protected onRadiusChange(event: Event): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.radiusChange.emit(value);
  }
}
