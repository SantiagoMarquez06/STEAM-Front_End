import { Component, inject } from '@angular/core';
import { ErrorMessageService } from './core/error-handling/error-message.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false
})
export class AppComponent {
  private readonly errorMessageService = inject(ErrorMessageService);

  title = 'Front-end-Steam';
  errorMessage$ = this.errorMessageService.message$;

  clearError(): void {
    this.errorMessageService.clear();
  }
}
