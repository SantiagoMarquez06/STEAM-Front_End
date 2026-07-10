import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CargarInformacionService {
  private readonly apiBase = '/api/importaciones';

  constructor(private readonly http: HttpClient) {}

  previsualizar(origen: string, archivo: File): Observable<ImportacionExcelPreview> {
    const formData = new FormData();
    formData.append('origen', origen);
    formData.append('archivo', archivo);
    return this.http.post<ImportacionExcelPreview>(`${this.apiBase}/preview`, formData);
  }

  importar(
    origen: string,
    archivo: File,
    mapeo: Record<string, string>,
    valoresManuales: Record<string, string>,
    filasExcluidas: number[]
  ): Observable<ImportacionExcelResultado> {
    const formData = new FormData();
    formData.append('origen', origen);
    formData.append('archivo', archivo);
    formData.append('mapeo', JSON.stringify(mapeo));
    formData.append('valoresManuales', JSON.stringify(valoresManuales));
    formData.append('filasExcluidas', JSON.stringify(filasExcluidas));
    return this.http.post<ImportacionExcelResultado>(`${this.apiBase}/excel`, formData);
  }
}

export interface ImportacionExcelPreview {
  filasLeidas: number;
  hoja?: string;
  filaEncabezado?: number;
  encabezados: string[];
  campos: string[];
  camposObligatorios: string[];
  mapeoSugerido: Record<string, string>;
  filas: Array<Record<string, string>>;
}

export interface ImportacionExcelResultado {
  filasLeidas: number;
  creados: number;
  actualizados: number;
  errores: number;
  detalles: string[];
}
