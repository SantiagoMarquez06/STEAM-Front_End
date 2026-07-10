import { ErrorHandler, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ErrorMessageService } from './error-message.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private readonly errorMessageService: ErrorMessageService) {}

  handleError(error: unknown): void {
    console.error(error);
    this.errorMessageService.show({
      title: 'Error inesperado',
      message: this.resolveMessage(error),
    });
  }

  private resolveMessage(error: unknown): string {
    const message = this.extractMessage(error);

    if (!environment.production && message) {
      return message;
    }

    return 'Ocurrio un problema en la aplicacion. Revisa la consola del navegador para mas detalles.';
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null) {
      const candidate = error as Record<string, any>;
      return candidate['message'] || candidate['rejection']?.message || candidate['ngOriginalError']?.message || '';
    }

    return String(error || '');
  }
}
