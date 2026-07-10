import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { ReportesService } from './reportes.service';

interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  filename: string;
  icon: string;
  suggestedUse: string;
}

interface CustomReportSource {
  key: string;
  label: string;
  description: string;
  columns: Array<{ key: string; label: string }>;
}

@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss',
  standalone: false,
})
export class ReportesComponent implements OnDestroy {
  heading = 'Reportes';
  subheading = 'Descarga informacion del sistema en formato Excel.';
  icon = 'pe-7s-note2 icon-gradient bg-mean-fruit';

  downloadingKey = '';
  error = '';
  success = '';
  customSource = 'MATRICULAS';
  customColumns: Record<string, boolean> = {};

  reports: ReportDefinition[] = [
    {
      key: 'estudiantes-pendientes-vinculacion',
      title: 'Estudiantes pendientes de vinculacion',
      description: 'Lista estudiantes matriculados que aun no tienen todos sus documentos aprobados.',
      filename: 'estudiantes-pendientes-vinculacion.xlsx',
      icon: 'pe-7s-users',
      suggestedUse: 'Ideal para seguimiento por carrera/curso y alertas tempranas.'
    },
    {
      key: 'progreso-matriculas',
      title: 'Progreso de matriculas',
      description: 'Exporta cada matricula con estudiante, proyecto, tutor, documentos aprobados, total de documentos y porcentaje de progreso.',
      filename: 'progreso-matriculas.xlsx',
      icon: 'pe-7s-graph1',
      suggestedUse: 'Util para revisar avance general y detectar estudiantes en riesgo.'
    },
    {
      key: 'documentos-pendientes',
      title: 'Documentos pendientes o rechazados',
      description: 'Muestra documentos de estudiantes que requieren revision o correccion.',
      filename: 'documentos-pendientes-rechazados.xlsx',
      icon: 'pe-7s-file',
      suggestedUse: 'Perfecto para control documental y trabajo de secretaria/coordinacion.'
    },
    {
      key: 'resumen-carreras',
      title: 'Resumen por carrera',
      description: 'Resume estudiantes, matriculas, completados, pendientes y promedio de progreso por carrera.',
      filename: 'resumen-carreras.xlsx',
      icon: 'pe-7s-study',
      suggestedUse: 'Bueno para informes directivos y comparacion entre carreras.'
    },
    {
      key: 'planificacion-vinculacion',
      title: 'Planificacion de vinculacion',
      description: 'Exporta planificaciones por carrera con periodo, proyecto, tutor, responsable, link y observaciones.',
      filename: 'planificacion-vinculacion.xlsx',
      icon: 'pe-7s-network',
      suggestedUse: 'Sirve para revisar cupos, responsables y organizacion por periodo.'
    },
  ];

  customSources: CustomReportSource[] = [
    {
      key: 'FACULTADES',
      label: 'Facultades',
      description: 'Facultades, direccion y estado.',
      columns: [
        { key: 'id', label: '# Facultad' },
        { key: 'facultad', label: 'Facultad' },
        { key: 'direccion', label: 'Direccion' },
        { key: 'estado', label: 'Estado' },
      ],
    },
    {
      key: 'CARRERAS',
      label: 'Carreras',
      description: 'Informacion base de carreras, facultades y estado.',
      columns: [
        { key: 'id', label: '# Carrera' },
        { key: 'carrera', label: 'Carrera' },
        { key: 'facultad', label: 'Facultad' },
        { key: 'estado', label: 'Estado' },
      ],
    },
    {
      key: 'CICLOS',
      label: 'Ciclos',
      description: 'Ciclos academicos y estado.',
      columns: [
        { key: 'id', label: '# Ciclo' },
        { key: 'ciclo', label: 'Ciclo' },
        { key: 'estado', label: 'Estado' },
      ],
    },
    {
      key: 'MALLAS',
      label: 'Mallas',
      description: 'Mallas asociadas a carreras.',
      columns: [
        { key: 'id', label: '# Malla' },
        { key: 'malla', label: 'Malla' },
        { key: 'descripcion', label: 'Descripcion' },
        { key: 'carrera', label: 'Carrera' },
      ],
    },
    {
      key: 'PERIODOS',
      label: 'Periodos de vinculacion',
      description: 'Rangos de fechas de periodos y estado.',
      columns: [
        { key: 'id', label: '# Periodo' },
        { key: 'inicio', label: 'Inicio' },
        { key: 'fin', label: 'Fin' },
        { key: 'estado', label: 'Estado' },
      ],
    },
    {
      key: 'TUTORES',
      label: 'Tutores',
      description: 'Informacion de tutores y estado.',
      columns: [
        { key: 'id', label: '# Tutor' },
        { key: 'cedula', label: 'Cedula' },
        { key: 'nombres', label: 'Tutor' },
        { key: 'correo', label: 'Correo' },
        { key: 'telefono', label: 'Telefono' },
        { key: 'estado', label: 'Estado' },
      ],
    },
    {
      key: 'INSTITUCIONES',
      label: 'Instituciones',
      description: 'Instituciones vinculadas a proyectos.',
      columns: [
        { key: 'id', label: '# Institucion' },
        { key: 'institucion', label: 'Institucion' },
        { key: 'descripcion', label: 'Descripcion' },
        { key: 'estado', label: 'Estado' },
      ],
    },
    {
      key: 'PROYECTOS',
      label: 'Proyectos',
      description: 'Proyectos, institucion, fechas, tutor y estado.',
      columns: [
        { key: 'id', label: '# Proyecto' },
        { key: 'proyecto', label: 'Proyecto' },
        { key: 'institucion', label: 'Institucion' },
        { key: 'inicio', label: 'Inicio' },
        { key: 'fin', label: 'Fin' },
        { key: 'tutor', label: 'Tutor proyecto' },
        { key: 'estado', label: 'Estado' },
        { key: 'descripcion', label: 'Descripcion' },
      ],
    },
    {
      key: 'DOCUMENTOS_BASE',
      label: 'Documentos base',
      description: 'Documentos definidos para vinculacion y su modelo.',
      columns: [
        { key: 'id', label: '# Documento' },
        { key: 'documento', label: 'Documento' },
        { key: 'descripcion', label: 'Descripcion' },
        { key: 'modelo', label: 'Link modelo' },
        { key: 'estado', label: 'Estado' },
      ],
    },
    {
      key: 'ESTUDIANTES',
      label: 'Estudiantes',
      description: 'Datos personales, carrera, ciclo, malla y estado de vinculacion.',
      columns: [
        { key: 'cedula', label: 'Cedula' },
        { key: 'nombres', label: 'Estudiante' },
        { key: 'correo', label: 'Correo' },
        { key: 'carrera', label: 'Carrera' },
        { key: 'facultad', label: 'Facultad' },
        { key: 'ciclo', label: 'Ciclo' },
        { key: 'malla', label: 'Malla' },
        { key: 'estadoVinculacion', label: 'Estado vinculacion' },
      ],
    },
    {
      key: 'MATRICULAS',
      label: 'Matriculas proyecto',
      description: 'Seguimiento de estudiantes matriculados, proyectos, tutores, documentos aprobados y progreso.',
      columns: [
        { key: 'id', label: '# Matricula' },
        { key: 'cedula', label: 'Cedula' },
        { key: 'estudiante', label: 'Estudiante' },
        { key: 'carrera', label: 'Carrera' },
        { key: 'ciclo', label: 'Ciclo' },
        { key: 'proyecto', label: 'Proyecto' },
        { key: 'institucion', label: 'Institucion' },
        { key: 'periodo', label: 'Periodo' },
        { key: 'tutor', label: 'Tutor' },
        { key: 'linkCarpeta', label: 'Link carpeta' },
        { key: 'observacion', label: 'Observacion' },
        { key: 'documentosAprobados', label: 'Documentos aprobados' },
        { key: 'totalDocumentos', label: 'Total documentos' },
        { key: 'progreso', label: 'Progreso' },
        { key: 'estado', label: 'Estado' },
      ],
    },
    {
      key: 'DOCUMENTOS',
      label: 'Documentos estudiantes',
      description: 'Estado documental por estudiante, matricula, proyecto y periodo.',
      columns: [
        { key: 'id', label: '# Entrega' },
        { key: 'documento', label: 'Documento' },
        { key: 'estado', label: 'Estado' },
        { key: 'cedula', label: 'Cedula' },
        { key: 'estudiante', label: 'Estudiante' },
        { key: 'carrera', label: 'Carrera' },
        { key: 'proyecto', label: 'Proyecto' },
        { key: 'periodo', label: 'Periodo' },
        { key: 'fechaAutorizacion', label: 'Fecha autorizacion' },
        { key: 'link', label: 'Link carpeta' },
      ],
    },
    {
      key: 'ESTADOS_VINCULACION',
      label: 'Estados vinculacion',
      description: 'Catalogo de estados de vinculacion de estudiantes.',
      columns: [
        { key: 'id', label: '# Estado' },
        { key: 'estado', label: 'Estado' },
        { key: 'descripcion', label: 'Descripcion' },
      ],
    },
    {
      key: 'RESPONSABLES',
      label: 'Responsables',
      description: 'Catalogo de responsables asignables a planificaciones.',
      columns: [
        { key: 'id', label: '# Responsable' },
        { key: 'responsable', label: 'Responsable' },
        { key: 'correo', label: 'Correo' },
        { key: 'estado', label: 'Estado' },
      ],
    },
    {
      key: 'PLANIFICACION',
      label: 'Planificacion vinculacion',
      description: 'Planificaciones por carrera, periodo, proyecto, tutor y responsable.',
      columns: [
        { key: 'id', label: '# Planificacion' },
        { key: 'carrera', label: 'Carrera' },
        { key: 'proyecto', label: 'Proyecto' },
        { key: 'periodo', label: 'Periodo' },
        { key: 'tutor', label: 'Tutor' },
        { key: 'responsable', label: 'Responsable' },
        { key: 'numeroEstudiantes', label: 'Numero estudiantes' },
        { key: 'link', label: 'Link' },
        { key: 'observaciones', label: 'Observaciones' },
      ],
    },
  ];

  private viewRefreshQueued = false;
  private destroyed = false;

  constructor(
    private readonly reportesService: ReportesService,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.selectRecommendedColumns();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  descargar(reporte: ReportDefinition): void {
    this.downloadingKey = reporte.key;
    this.error = '';
    this.success = '';
    this.refreshView();

    this.reportesService.descargar(reporte.key)
      .pipe(
        timeout(30000),
        finalize(() => {
          this.downloadingKey = '';
          this.refreshView();
        })
      )
      .subscribe({
        next: response => {
          const blob = response.body;
          if (!blob || blob.size === 0) {
            this.error = 'El reporte no devolvio contenido.';
            this.refreshView();
            return;
          }

          this.downloadBlob(blob, reporte.filename);
          this.success = `Reporte "${reporte.title}" descargado correctamente.`;
          this.refreshView();
          },
          error: error => {
            this.handleDownloadError(error);
          }
        });
  }

  isDownloading(reporte: ReportDefinition): boolean {
    return this.downloadingKey === reporte.key;
  }

  selectedSource(): CustomReportSource {
    return this.customSources.find(source => source.key === this.customSource) || this.customSources[0];
  }

  selectedCustomColumns(): string[] {
    return this.selectedSource().columns
      .filter(column => this.customColumns[column.key])
      .map(column => column.key);
  }

  onCustomSourceChange(): void {
    this.customColumns = {};
    this.selectRecommendedColumns();
    this.refreshView();
  }

  toggleAllCustomColumns(value: boolean): void {
    this.selectedSource().columns.forEach(column => {
      this.customColumns[column.key] = value;
    });
  }

  descargarPersonalizado(): void {
    const columnas = this.selectedCustomColumns();
    if (columnas.length === 0) {
      this.error = 'Seleccione al menos una columna para generar el reporte personalizado.';
      return;
    }

    this.downloadingKey = 'personalizado';
    this.error = '';
    this.success = '';
    this.refreshView();

    this.reportesService.descargarPersonalizado(this.customSource, columnas)
      .pipe(
        timeout(30000),
        finalize(() => {
          this.downloadingKey = '';
          this.refreshView();
        })
      )
      .subscribe({
        next: response => {
          const blob = response.body;
          if (!blob || blob.size === 0) {
            this.error = 'El reporte personalizado no devolvio contenido.';
            this.refreshView();
            return;
          }

          this.downloadBlob(blob, `reporte-personalizado-${this.customSource.toLowerCase()}.xlsx`);
          this.success = 'Reporte personalizado descargado correctamente.';
          this.refreshView();
        },
        error: error => {
          this.handleDownloadError(error);
        }
      });
  }

  isDownloadingCustom(): boolean {
    return this.downloadingKey === 'personalizado';
  }

  private selectRecommendedColumns(): void {
    this.selectedSource().columns.slice(0, 6).forEach(column => {
      this.customColumns[column.key] = true;
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private resolveError(error: any): string {
    if (error?.name === 'TimeoutError') {
      return 'La API tardo demasiado en generar el reporte. Intenta nuevamente o revisa el backend.';
    }

    if (error?.status === 401 || error?.status === 403) {
      return 'No tienes permisos para descargar este reporte o tu sesion expiro.';
    }

    return 'No se pudo descargar el reporte. Revisa el backend para ver el detalle del error.';
  }

  private handleDownloadError(error: any): void {
    const fallback = this.resolveError(error);

    if (error?.error instanceof Blob && error.error.size > 0) {
      error.error.text()
        .then((text: string) => {
          this.error = this.messageFromBlobError(text, fallback);
          this.refreshView();
        })
        .catch(() => {
          this.error = fallback;
          this.refreshView();
        });
      return;
    }

    this.error = fallback;
    this.refreshView();
  }

  private messageFromBlobError(text: string, fallback: string): string {
    if (!text || !text.trim()) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(text);
      return parsed?.message || parsed?.error || fallback;
    } catch {
      return text.trim();
    }
  }

  private refreshView(): void {
    if (this.viewRefreshQueued || this.destroyed) {
      return;
    }

    this.viewRefreshQueued = true;
    queueMicrotask(() => {
      this.viewRefreshQueued = false;
      if (!this.destroyed) {
        this.changeDetector.detectChanges();
      }
    });
  }
}
