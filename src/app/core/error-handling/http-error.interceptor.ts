import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { ErrorMessageService } from './error-message.service';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(private readonly errorMessageService: ErrorMessageService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          this.errorMessageService.showFromHttpError(error);
        }

        return throwError(() => error);
      })
    );
  }
}
