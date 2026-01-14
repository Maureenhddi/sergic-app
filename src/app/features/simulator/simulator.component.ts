import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-simulator',
  imports: [FormsModule, DecimalPipe, HeaderComponent],
  templateUrl: './simulator.component.html',
  styleUrl: './simulator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulatorComponent {
  protected readonly activeTab = signal<'loan' | 'notary' | 'capacity'>('loan');

  // Loan simulator
  protected readonly loanAmount = signal(200000);
  protected readonly loanDuration = signal(20);
  protected readonly loanRate = signal(3.5);
  protected readonly insuranceRate = signal(0.34);
  protected readonly downPayment = signal(20000);

  // Notary fees
  protected readonly propertyPrice = signal(200000);
  protected readonly propertyType = signal<'old' | 'new'>('old');
  protected readonly department = signal('75');

  // Capacity
  protected readonly monthlyIncome = signal(4000);
  protected readonly monthlyCharges = signal(500);
  protected readonly desiredDuration = signal(20);
  protected readonly desiredRate = signal(3.5);

  // Loan calculations
  protected readonly monthlyPayment = computed(() => {
    const principal = this.loanAmount() - this.downPayment();
    const monthlyRate = this.loanRate() / 100 / 12;
    const months = this.loanDuration() * 12;

    if (monthlyRate === 0) return principal / months;

    const x = Math.pow(1 + monthlyRate, months);
    return (principal * monthlyRate * x) / (x - 1);
  });

  protected readonly monthlyInsurance = computed(() => {
    const principal = this.loanAmount() - this.downPayment();
    return (principal * this.insuranceRate() / 100) / 12;
  });

  protected readonly totalMonthly = computed(() => {
    return this.monthlyPayment() + this.monthlyInsurance();
  });

  protected readonly totalInterest = computed(() => {
    const months = this.loanDuration() * 12;
    const principal = this.loanAmount() - this.downPayment();
    return (this.monthlyPayment() * months) - principal;
  });

  protected readonly totalInsurance = computed(() => {
    const months = this.loanDuration() * 12;
    return this.monthlyInsurance() * months;
  });

  protected readonly totalCost = computed(() => {
    return this.totalInterest() + this.totalInsurance();
  });

  protected readonly totalRepaid = computed(() => {
    const principal = this.loanAmount() - this.downPayment();
    return principal + this.totalCost();
  });

  // Notary fees calculations
  protected readonly notaryFees = computed(() => {
    const price = this.propertyPrice();
    const isNew = this.propertyType() === 'new';

    // Droits de mutation (taxes)
    const mutationRate = isNew ? 0.00715 : 0.0580665;
    const mutationFees = price * mutationRate;

    // Émoluments du notaire (barème 2024)
    let emoluments = 0;
    if (price <= 6500) {
      emoluments = price * 0.03870;
    } else if (price <= 17000) {
      emoluments = 6500 * 0.03870 + (price - 6500) * 0.01596;
    } else if (price <= 60000) {
      emoluments = 6500 * 0.03870 + 10500 * 0.01596 + (price - 17000) * 0.01064;
    } else {
      emoluments = 6500 * 0.03870 + 10500 * 0.01596 + 43000 * 0.01064 + (price - 60000) * 0.00799;
    }

    // Frais et débours
    const debours = isNew ? price * 0.001 : price * 0.01;

    // Contribution de sécurité immobilière
    const securityContribution = price * 0.001;

    // TVA sur émoluments
    const tvaEmoluments = emoluments * 0.2;

    return {
      mutationFees,
      emoluments,
      tvaEmoluments,
      debours,
      securityContribution,
      total: mutationFees + emoluments + tvaEmoluments + debours + securityContribution
    };
  });

  protected readonly totalProjectCost = computed(() => {
    return this.propertyPrice() + this.notaryFees().total;
  });

  // Borrowing capacity calculations
  protected readonly maxMonthlyPayment = computed(() => {
    // Taux d'endettement max 35%
    return (this.monthlyIncome() - this.monthlyCharges()) * 0.35;
  });

  protected readonly borrowingCapacity = computed(() => {
    const monthlyRate = this.desiredRate() / 100 / 12;
    const months = this.desiredDuration() * 12;
    const payment = this.maxMonthlyPayment();

    if (monthlyRate === 0) return payment * months;

    const x = Math.pow(1 + monthlyRate, months);
    return payment * (x - 1) / (monthlyRate * x);
  });

  protected readonly debtRatio = computed(() => {
    const monthlyDebt = this.maxMonthlyPayment();
    return (monthlyDebt / this.monthlyIncome()) * 100;
  });

  protected setTab(tab: 'loan' | 'notary' | 'capacity'): void {
    this.activeTab.set(tab);
  }

  protected updateLoanAmount(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.loanAmount.set(parseInt(value, 10) || 0);
  }

  protected updateLoanDuration(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.loanDuration.set(parseInt(value, 10) || 0);
  }

  protected updateLoanRate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.loanRate.set(parseFloat(value) || 0);
  }

  protected updateInsuranceRate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.insuranceRate.set(parseFloat(value) || 0);
  }

  protected updateDownPayment(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.downPayment.set(parseInt(value, 10) || 0);
  }

  protected updatePropertyPrice(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.propertyPrice.set(parseInt(value, 10) || 0);
  }

  protected updatePropertyType(type: 'old' | 'new'): void {
    this.propertyType.set(type);
  }

  protected updateMonthlyIncome(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.monthlyIncome.set(parseInt(value, 10) || 0);
  }

  protected updateMonthlyCharges(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.monthlyCharges.set(parseInt(value, 10) || 0);
  }

  protected updateDesiredDuration(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.desiredDuration.set(parseInt(value, 10) || 0);
  }

  protected updateDesiredRate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.desiredRate.set(parseFloat(value) || 0);
  }
}
