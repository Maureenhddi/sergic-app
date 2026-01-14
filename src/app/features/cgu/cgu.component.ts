import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-cgu',
  imports: [HeaderComponent],
  templateUrl: './cgu.component.html',
  styleUrl: './cgu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CguComponent {}
