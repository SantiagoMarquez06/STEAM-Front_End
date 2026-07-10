import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { finalize, map, Observable, of, shareReplay, tap } from 'rxjs';

export interface Periodo {
  idPeriodo?: number;
  fechInicio: string;
  fechFin: string;
  estadoPeriodo: string;
}

export interface Proyecto {
  idProyecto?: number;
  nombreProyecto: string;
  fechaInicioP: string;
  fechaFinP: string;
  descripcionProyecto: string;
  idInstitucion: number;
  idTutor: number;
  estadoProyecto: string;
  tutorProyecto?: string;
}

export interface Institucion {
  idInstitucion?: number;
  nomInstitucion: string;
  desInstitucion?: string;
  estadoInstitucion: string;
}

export interface Estado {
  idEstado?: number;
  nomEstado: string;
  desEstado?: string;
}

export type AdminRecord = Periodo | Proyecto | Estado | Institucion;
export type GenericAdminRecord = Record<string, any>;

export interface AdminPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export interface DashboardProgress {
  id: number;
  student: string;
  career: string;
  project: string;
  approvedDocuments: number;
  totalDocuments: number;
  progress: number;
  status: string;
}

export interface DashboardSummary {
  totalStudents: number;
  activeProjects: number;
  totalEnrollments: number;
  pendingDocuments: number;
  averageProgress: number;
  completedStudents: number;
  studentsAtRisk: number;
  progressRecords: DashboardProgress[];
}

@Injectable()
export class AdminDataService {
  private readonly apiBase = '/api';
  private readonly cache = new Map<string, AdminPage<GenericAdminRecord>>();
  private readonly pendingRequests = new Map<string, Observable<AdminPage<GenericAdminRecord>>>();

  constructor(private readonly http: HttpClient) {}

  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.apiBase}/dashboard/resumen`);
  }

  listPage<T extends GenericAdminRecord>(
    endpoint: string,
    page: number,
    size: number,
    forceRefresh = false,
    params: Record<string, string | number | boolean> = {}
  ): Observable<AdminPage<T>> {
    const extraQuery = Object.entries(params)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    const cacheKey = `${endpoint}:${page}:${size}:${extraQuery}`;

    if (!forceRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey) as AdminPage<T>;
      return of({ ...cached, content: [...cached.content] });
    }

    if (!forceRefresh && this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey) as Observable<AdminPage<T>>;
    }

    const request = this.http.get<AdminPage<T> | T[]>(`${this.apiBase}/${endpoint}?page=${page}&size=${size}${extraQuery ? '&' + extraQuery : ''}`).pipe(
      map(response => this.normalizePage(response, page, size)),
      tap(records => this.cache.set(cacheKey, records as AdminPage<GenericAdminRecord>)),
      finalize(() => this.pendingRequests.delete(cacheKey)),
      shareReplay(1)
    );

    this.pendingRequests.set(cacheKey, request as Observable<AdminPage<GenericAdminRecord>>);
    return request;
  }

  listAll<T extends GenericAdminRecord>(endpoint: string, forceRefresh = false): Observable<T[]> {
    const cacheKey = `${endpoint}:all`;

    if (!forceRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey) as AdminPage<T>;
      return of([...(cached.content || [])]);
    }

    if (!forceRefresh && this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!.pipe(
        map(page => [...(page.content || [])] as T[])
      );
    }

    const request = this.http.get<AdminPage<T> | T[]>(`${this.apiBase}/${endpoint}`).pipe(
      map(response => this.normalizePage(response, 0, 0).content),
      map(content => ({
        content,
        totalElements: content.length,
        totalPages: content.length > 0 ? 1 : 0,
        number: 0,
        size: content.length,
        first: true,
        last: true
      } as AdminPage<T>)),
      tap(page => this.cache.set(cacheKey, page as AdminPage<GenericAdminRecord>)),
      finalize(() => this.pendingRequests.delete(cacheKey)),
      shareReplay(1)
    );

    this.pendingRequests.set(cacheKey, request as Observable<AdminPage<GenericAdminRecord>>);
    return request.pipe(map(page => [...(page.content || [])] as T[]));
  }

  getById<T extends GenericAdminRecord>(endpoint: string, id: number): Observable<T> {
    return this.http.get<T>(`${this.apiBase}/${endpoint}/${id}`);
  }

  create<T extends GenericAdminRecord>(endpoint: string, payload: T): Observable<T> {
    return this.http.post<T>(`${this.apiBase}/${endpoint}`, payload).pipe(
      tap(record => this.addToCache(endpoint, record))
    );
  }

  update<T extends GenericAdminRecord>(endpoint: string, id: number, payload: T): Observable<T> {
    return this.http.put<T>(`${this.apiBase}/${endpoint}/${id}`, payload).pipe(
      tap(record => this.replaceInCache(endpoint, id, record))
    );
  }

  updateStudentDocumentStatus<T extends GenericAdminRecord>(id: number, status: string): Observable<T> {
    const encodedStatus = encodeURIComponent(status);
    return this.http.patch<T>(`${this.apiBase}/estudiante-documentos/${id}/estado?nuevoEstado=${encodedStatus}`, {}).pipe(
      tap(() => {
        this.clearCache('estudiante-documentos');
        this.clearCache('matriculas-proyecto');
      })
    );
  }

  delete(endpoint: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/${endpoint}/${id}`).pipe(
      tap(() => this.removeFromCache(endpoint, id))
    );
  }

  private addToCache(endpoint: string, record: GenericAdminRecord): void {
    this.clearCache(endpoint);
  }

  private replaceInCache(endpoint: string, id: number, record: GenericAdminRecord): void {
    this.clearCache(endpoint);
  }

  private removeFromCache(endpoint: string, id: number): void {
    this.clearCache(endpoint);
  }

  private clearCache(endpoint: string): void {
    Array.from(this.cache.keys())
      .filter(key => key.startsWith(`${endpoint}:`))
      .forEach(key => this.cache.delete(key));

    if (endpoint === 'documentos') {
      ['estudiante-documentos', 'matriculas-proyecto'].forEach(relatedEndpoint =>
        Array.from(this.cache.keys())
          .filter(key => key.startsWith(`${relatedEndpoint}:`))
          .forEach(key => this.cache.delete(key))
      );
    }
  }

  private normalizePage<T extends GenericAdminRecord>(response: AdminPage<T> | T[], page: number, size: number): AdminPage<T> {
    if (Array.isArray(response)) {
      return {
        content: response,
        totalElements: response.length,
        totalPages: response.length > 0 ? 1 : 0,
        number: page,
        size,
        first: true,
        last: true
      };
    }

    return {
      content: response.content || [],
      totalElements: response.totalElements || 0,
      totalPages: response.totalPages || 0,
      number: response.number || 0,
      size: response.size || size,
      first: Boolean(response.first),
      last: Boolean(response.last)
    };
  }
}
