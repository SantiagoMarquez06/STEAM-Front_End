import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly apiBase = '/api/reportes';

  constructor(private readonly http: HttpClient) {}

  descargar(endpoint: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.apiBase}/${endpoint}`, {
      observe: 'response',
      responseType: 'blob'
    });
  }

  descargarPersonalizado(origen: string, columnas: string[]): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.apiBase}/personalizado`, { origen, columnas }, {
      observe: 'response',
      responseType: 'blob'
    });
  }
}
