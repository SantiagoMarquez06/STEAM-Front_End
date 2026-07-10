import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { ApiErrorResponse, AppErrorMessage } from './api-error.model';

@Injectable({ providedIn: 'root' })
export class ErrorMessageService {
  private readonly messageSubject = new BehaviorSubject<AppErrorMessage | null>(null);
  readonly message$ = this.messageSubject.asObservable();

  show(message: AppErrorMessage): void {
    this.messageSubject.next(message);
  }

  clear(): void {
    this.messageSubject.next(null);
  }

  showFromHttpError(error: HttpErrorResponse): void {
    this.show(this.normalizeHttpError(error));
  }

  private normalizeHttpError(error: HttpErrorResponse): AppErrorMessage {
    const body = this.isApiError(error.error) ? error.error : null;
    const validations = body?.validations;
    const validationSummary = validations
      ? Object.entries(validations)
        .map(([field, message]) => `${this.readableField(field)}: ${message}`)
        .join(' ')
      : '';

    return {
      title: body?.error || this.titleFromStatus(error.status),
      message: validationSummary || body?.message || error.message || 'No se pudo completar la solicitud.',
      status: body?.status || error.status,
      path: body?.path || error.url || undefined,
      validations,
    };
  }

  private isApiError(value: unknown): value is ApiErrorResponse {
    return typeof value === 'object' && value !== null;
  }

  private titleFromStatus(status: number): string {
    if (status === 0) return 'No hay conexion con el servidor';
    if (status === 400) return 'Solicitud incorrecta';
    if (status === 401) return 'Sesion requerida';
    if (status === 403) return 'Acceso denegado';
    if (status === 404) return 'Recurso no encontrado';
    if (status === 409) return 'Conflicto de datos';
    if (status >= 500) return 'Error del servidor';
    return 'Error inesperado';
  }

  private readableField(field: string): string {
    return field
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/^./, character => character.toUpperCase());
  }
}
