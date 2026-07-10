import { ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import {
  CargarInformacionService,
  ImportacionExcelPreview,
  ImportacionExcelResultado
} from './cargar-informacion.service';
import { AdminDataService, GenericAdminRecord } from '../Administracion/admin-data.service';

interface ImportSource {
  key: string;
  label: string;
  description: string;
}

interface SystemValueOption {
  label: string;
  value: string;
}

interface SystemValueConfig {
  endpoint?: string;
  valueKey?: string;
  labelKeys?: string[];
  options?: SystemValueOption[];
}

const FIELD_LABELS: Record<string, string> = {
  facultad: 'Facultad',
  direccion: 'Direccion',
  estado: 'Estado',
  carrera: 'Carrera',
  ciclo: 'Ciclo',
  inicio: 'Inicio',
  fin: 'Fin',
  cedula: 'Cedula',
  nombres: 'Nombre completo',
  correo: 'Correo',
  telefono: 'Telefono',
  institucion: 'Institucion',
  descripcion: 'Descripcion',
  proyecto: 'Proyecto',
  tutor: 'Tutor',
  responsable: 'Responsable',
  documento: 'Documento',
  modelo: 'Link modelo',
  malla: 'Malla',
  estadoVinculacion: 'Estado vinculacion',
};

const SOURCE_IDENTIFIER_FIELDS: Record<string, string[]> = {
  FACULTADES: ['facultad'],
  CARRERAS: ['carrera'],
  CICLOS: ['ciclo'],
  MALLAS: ['malla', 'carrera'],
  PERIODOS: ['inicio', 'fin'],
  TUTORES: ['cedula'],
  RESPONSABLES: ['responsable'],
  INSTITUCIONES: ['institucion'],
  PROYECTOS: ['proyecto'],
  DOCUMENTOS_BASE: ['documento'],
  ESTUDIANTES: ['cedula'],
  ESTADOS_VINCULACION: ['estado'],
};

const SYSTEM_VALUE_CONFIGS: Record<string, SystemValueConfig> = {
  facultad: {
    endpoint: 'facultades',
    valueKey: 'idFacultad',
    labelKeys: ['nomFacultad', 'direcFacultad'],
  },
  carrera: {
    endpoint: 'carreras',
    valueKey: 'idCarrera',
    labelKeys: ['nomCarrera', 'facultad.nomFacultad'],
  },
  ciclo: {
    endpoint: 'ciclos',
    valueKey: 'idCiclo',
    labelKeys: ['nomCiclo'],
  },
  malla: {
    endpoint: 'mallas',
    valueKey: 'idMalla',
    labelKeys: ['nomMalla', 'carrera.nomCarrera'],
  },
  institucion: {
    endpoint: 'instituciones',
    valueKey: 'idInstitucion',
    labelKeys: ['nomInstitucion'],
  },
  tutor: {
    endpoint: 'tutores',
    labelKeys: ['nombreTutor', 'cedulaTutor'],
  },
  estadoVinculacion: {
    endpoint: 'estados-vinculacion',
    valueKey: 'idEstado',
    labelKeys: ['nomEstado'],
  },
  estado: {
    options: [
      { label: 'ACTIVO', value: 'ACTIVO' },
      { label: 'INACTIVO', value: 'INACTIVO' },
      { label: 'PENDIENTE', value: 'PENDIENTE' },
      { label: 'APROBADO', value: 'APROBADO' },
      { label: 'RECHAZADO', value: 'RECHAZADO' },
      { label: 'EN CURSO', value: 'EN CURSO' },
    ],
  },
};

@Component({
  selector: 'app-cargar-informacion',
  templateUrl: './cargar-informacion.component.html',
  styleUrl: './cargar-informacion.component.scss',
  standalone: false,
})
export class CargarInformacionComponent implements OnDestroy {
  @ViewChild('excelInput') excelInput?: ElementRef<HTMLInputElement>;

  heading = 'Cargar informacion';
  subheading = 'Importa datos desde Excel con vista previa, mapeo de columnas y validacion antes de guardar.';
  icon = 'pe-7s-cloud-upload icon-gradient bg-grow-early';

  sources: ImportSource[] = [
    { key: 'ESTUDIANTES', label: 'Estudiantes', description: 'Datos del estudiante y relaciones academicas.' },
  ];

  source = 'ESTUDIANTES';
  file: File | null = null;
  preview: ImportacionExcelPreview | null = null;
  result: ImportacionExcelResultado | null = null;
  mapping: Record<string, string> = {};
  manualValues: Record<string, string> = {};
  systemValueSearch: Record<string, string> = {};
  systemValueOptions: Record<string, SystemValueOption[]> = {};
  activeSystemField = '';
  excludedRows = new Set<number>();
  previewPage = 1;
  readonly previewPageSize = 15;
  loadingPreview = false;
  importing = false;
  error = '';
  success = '';

  private viewRefreshQueued = false;
  private destroyed = false;

  constructor(
    private readonly cargarService: CargarInformacionService,
    private readonly adminDataService: AdminDataService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  selectedSource(): ImportSource {
    return this.sources.find(source => source.key === this.source) || this.sources[0];
  }

  fieldLabel(field: string): string {
    return FIELD_LABELS[field] || field;
  }

  isRequired(field: string): boolean {
    return !!this.preview?.camposObligatorios.includes(field);
  }

  isSystemValueField(field: string): boolean {
    return !!SYSTEM_VALUE_CONFIGS[field] && !this.isCatalogNameField(field);
  }

  systemOptions(field: string): SystemValueOption[] {
    if (field === 'estado') {
      return this.statusOptionsForSource();
    }
    return this.systemValueOptions[field] || SYSTEM_VALUE_CONFIGS[field]?.options || [];
  }

  filteredSystemOptions(field: string): SystemValueOption[] {
    const search = this.normalize(this.systemValueSearch[field] || '');
    const currentValue = String(this.manualValues[field] || '');
    return this.systemOptions(field)
      .filter(option => !search || this.normalize(option.label).includes(search))
      .filter((option, index) => index < 25 || String(option.value) === currentValue);
  }

  systemComboText(field: string): string {
    return this.systemValueSearch[field] || this.selectedSystemOptionLabel(field) || '';
  }

  exampleFieldLabels(): string {
    const fields = this.preview?.campos || [];
    return fields.slice(0, 3).map(field => this.fieldLabel(field)).join(', ');
  }

  identifierLabel(): string {
    const fields = SOURCE_IDENTIFIER_FIELDS[this.source] || [];
    return fields.map(field => this.fieldLabel(field)).join(', ');
  }

  onSourceChange(): void {
    this.preview = null;
    this.result = null;
    this.mapping = {};
    this.manualValues = {};
    this.systemValueSearch = {};
    this.activeSystemField = '';
    this.excludedRows.clear();
    this.previewPage = 1;
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] || null;
    this.preview = null;
    this.result = null;
    this.mapping = {};
    this.manualValues = {};
    this.systemValueSearch = {};
    this.activeSystemField = '';
    this.excludedRows.clear();
    this.previewPage = 1;
  }

  cargarOtroExcel(): void {
    this.file = null;
    this.preview = null;
    this.result = null;
    this.mapping = {};
    this.manualValues = {};
    this.systemValueSearch = {};
    this.activeSystemField = '';
    this.excludedRows.clear();
    this.previewPage = 1;
    this.error = '';
    this.success = '';
    this.loadingPreview = false;
    this.importing = false;
    if (this.excelInput?.nativeElement) {
      this.excelInput.nativeElement.value = '';
    }
    this.refreshView();
  }

  previsualizar(): void {
    if (!this.file) {
      this.error = 'Seleccione un archivo Excel para previsualizar.';
      return;
    }

    this.loadingPreview = true;
    this.error = '';
    this.success = '';
    this.result = null;
    this.refreshView();

    this.cargarService.previsualizar(this.source, this.file)
      .pipe(
        timeout(60000),
        finalize(() => {
          this.loadingPreview = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: preview => {
          this.preview = preview;
          this.mapping = { ...preview.mapeoSugerido };
          this.manualValues = {};
          this.systemValueSearch = {};
          this.excludedRows.clear();
          this.previewPage = 1;
          this.loadSystemOptions(preview.campos);
          this.success = `Archivo leido correctamente: ${preview.filasLeidas} filas detectadas. Revisa el mapeo antes de importar.`;
          this.refreshView();
        },
        error: error => {
          this.error = this.resolveError(error);
          this.refreshView();
        }
      });
  }

  importar(): void {
    if (!this.file || !this.preview) {
      this.error = 'Primero sube y previsualiza un archivo Excel.';
      return;
    }

    const missing = this.preview.camposObligatorios.filter(field => !this.hasFieldSource(field));
    if (missing.length) {
      this.error = `Faltan campos obligatorios: selecciona una columna del Excel o completa el valor para ${missing.map(field => this.fieldLabel(field)).join(', ')}.`;
      return;
    }

    this.importing = true;
    this.error = '';
    this.success = '';
    this.result = null;
    this.refreshView();

    this.cargarService.importar(this.source, this.file, this.mapping, this.cleanManualValues(), Array.from(this.excludedRows))
      .pipe(
        timeout(90000),
        finalize(() => {
          this.importing = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: result => {
          this.result = result;
          this.success = `Importacion finalizada: ${result.creados} creados, ${result.actualizados} actualizados, ${result.errores} errores.`;
          this.refreshView();
        },
        error: error => {
          this.error = this.resolveError(error);
          this.refreshView();
        }
      });
  }

  mappedPreviewHeaders(): string[] {
    return (this.preview?.campos || [])
      .filter(field => this.hasFieldSource(field))
      .map(field => this.fieldLabel(field));
  }

  mappedPreviewRows(): Array<Record<string, string>> {
    if (!this.preview) {
      return [];
    }

    const mappedFields = this.preview.campos.filter(field => this.hasFieldSource(field));
    return this.preview.filas
      .filter(row => !this.isRowExcluded(this.excelRowNumber(row)))
      .map(row => {
      const mappedRow: Record<string, string> = {};
      mappedRow['__excelRow'] = row['__excelRow'] || '';
      mappedFields.forEach(field => {
        const manual = this.manualPreviewValue(field);
        mappedRow[this.fieldLabel(field)] = manual || row[this.mapping[field]] || '';
      });
      return mappedRow;
    });
  }

  excludedPreviewRows(): Array<Record<string, string>> {
    if (!this.preview) {
      return [];
    }
    return this.preview.filas.filter(row => this.isRowExcluded(this.excelRowNumber(row)));
  }

  excelRowNumber(row: Record<string, string>): number {
    return Number(row['__excelRow'] || 0);
  }

  isRowExcluded(rowNumber: number): boolean {
    return rowNumber > 0 && this.excludedRows.has(rowNumber);
  }

  excludeRow(row: Record<string, string>): void {
    const rowNumber = this.excelRowNumber(row);
    if (rowNumber > 0) {
      this.excludedRows.add(rowNumber);
      this.previewPage = Math.min(this.previewPage, this.previewTotalPages());
      this.refreshView();
    }
  }

  restoreRow(rowNumber: number): void {
    this.excludedRows.delete(rowNumber);
    this.refreshView();
  }

  pagedPreviewRows(): Array<Record<string, string>> {
    const start = (this.previewPage - 1) * this.previewPageSize;
    return this.mappedPreviewRows().slice(start, start + this.previewPageSize);
  }

  previewTotalPages(): number {
    const total = this.mappedPreviewRows().length;
    return Math.max(1, Math.ceil(total / this.previewPageSize));
  }

  previewRangeLabel(): string {
    const total = this.mappedPreviewRows().length;
    if (!total) {
      return '0 de 0 filas';
    }
    const start = (this.previewPage - 1) * this.previewPageSize + 1;
    const end = Math.min(total, start + this.previewPageSize - 1);
    return `${start}-${end} de ${total} filas`;
  }

  goPreviewPage(delta: number): void {
    const next = Math.min(Math.max(1, this.previewPage + delta), this.previewTotalPages());
    if (next !== this.previewPage) {
      this.previewPage = next;
      this.refreshView();
    }
  }

  hasFieldSource(field: string): boolean {
    return !!this.mapping[field] || !!this.manualValue(field);
  }

  manualValue(field: string): string {
    return (this.manualValues[field] || '').trim();
  }

  manualPreviewValue(field: string): string {
    if (!this.manualValue(field)) {
      return '';
    }
    return this.isSystemValueField(field)
      ? this.selectedSystemOptionLabel(field) || this.manualValue(field)
      : this.manualValue(field);
  }

  clearMappingIfManual(field: string): void {
    if (this.manualValue(field)) {
      this.mapping[field] = '';
    }
  }

  onSystemValueInput(field: string, value: string): void {
    this.systemValueSearch[field] = value;
    const option = this.systemOptions(field).find(item => this.normalize(item.label) === this.normalize(value));
    this.manualValues[field] = option ? String(option.value) : '';
    if (option) {
      this.mapping[field] = '';
    }
  }

  onSystemValueFocus(field: string): void {
    this.activeSystemField = field;
  }

  onSystemValueBlur(field: string): void {
    setTimeout(() => {
      if (this.activeSystemField === field) {
        const option = this.systemOptions(field).find(item => String(item.value) === String(this.manualValues[field]));
        this.systemValueSearch[field] = option?.label || '';
        this.activeSystemField = '';
        this.refreshView();
      }
    }, 120);
  }

  selectSystemValue(field: string, option: SystemValueOption): void {
    this.manualValues[field] = String(option.value);
    this.systemValueSearch[field] = option.label;
    this.mapping[field] = '';
    this.activeSystemField = '';
    this.refreshView();
  }

  clearSystemValue(field: string): void {
    this.manualValues[field] = '';
    this.systemValueSearch[field] = '';
    this.refreshView();
  }

  private cleanManualValues(): Record<string, string> {
    return Object.entries(this.manualValues).reduce((values, [field, value]) => {
      const trimmed = (value || '').trim();
      if (trimmed) {
        values[field] = trimmed;
      }
      return values;
    }, {} as Record<string, string>);
  }

  private loadSystemOptions(fields: string[]): void {
    fields
      .filter(field => this.isSystemValueField(field))
      .forEach(field => {
        const config = SYSTEM_VALUE_CONFIGS[field];
        if (!config) {
          return;
        }
        if (config.options) {
          this.systemValueOptions[field] = config.options;
          return;
        }
        if (!config.endpoint) {
          return;
        }
        this.adminDataService.listAll<GenericAdminRecord>(config.endpoint)
          .pipe(timeout(60000))
          .subscribe({
            next: records => {
              this.systemValueOptions[field] = records.map(record => {
                const label = this.buildLabel(record, config.labelKeys || []);
                return {
                  value: String(config.valueKey ? this.valueOf(record, config.valueKey) : label),
                  label
                };
              }).filter(option => option.value && option.label);
              this.refreshView();
            },
            error: () => {
              this.systemValueOptions[field] = [];
              this.refreshView();
            }
          });
      });
  }

  private isCatalogNameField(field: string): boolean {
    return (this.source === 'FACULTADES' && field === 'facultad')
      || (this.source === 'CARRERAS' && field === 'carrera')
      || (this.source === 'CICLOS' && field === 'ciclo')
      || (this.source === 'MALLAS' && field === 'malla')
      || (this.source === 'INSTITUCIONES' && field === 'institucion')
      || (this.source === 'PROYECTOS' && field === 'proyecto')
      || (this.source === 'DOCUMENTOS_BASE' && field === 'documento')
      || (this.source === 'ESTADOS_VINCULACION' && field === 'estado');
  }

  private selectedSystemOptionLabel(field: string): string {
    const value = String(this.manualValues[field] || '');
    return this.systemOptions(field).find(option => String(option.value) === value)?.label || '';
  }

  private buildLabel(record: GenericAdminRecord, keys: string[]): string {
    const values = keys
      .map(key => this.valueOf(record, key))
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
      .map(value => String(value).trim());
    return values.length ? values.join(' - ') : String(this.valueOf(record, 'nombre') || this.valueOf(record, 'id') || '');
  }

  private valueOf(record: GenericAdminRecord, path: string): unknown {
    return path.split('.').reduce((current: any, segment) => current?.[segment], record);
  }

  private normalize(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private statusOptionsForSource(): SystemValueOption[] {
    if (this.source === 'DOCUMENTOS_BASE'
      || this.source === 'FACULTADES'
      || this.source === 'CARRERAS'
      || this.source === 'CICLOS'
      || this.source === 'PERIODOS'
      || this.source === 'TUTORES'
      || this.source === 'INSTITUCIONES'
      || this.source === 'PROYECTOS') {
      return [
        { label: 'ACTIVO', value: 'ACTIVO' },
        { label: 'INACTIVO', value: 'INACTIVO' },
      ];
    }
    return SYSTEM_VALUE_CONFIGS.estado.options || [];
  }

  private resolveError(error: any): string {
    if (error?.name === 'TimeoutError') {
      return 'La importacion tardo demasiado. Revisa el backend o intenta con menos filas.';
    }
    if (typeof error?.error === 'string') {
      return error.error;
    }
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.message) {
      return error.message;
    }
    return 'No se pudo procesar el Excel. Revisa el backend para ver el detalle.';
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
