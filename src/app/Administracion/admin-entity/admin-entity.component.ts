import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { ADMIN_ENTITIES, AdminEntityConfig, AdminField, AdminFilterOption } from '../admin-entity.config';
import { AdminDataService, GenericAdminRecord } from '../admin-data.service';

@Component({
  selector: 'app-admin-entity',
  templateUrl: './admin-entity.component.html',
  styleUrl: './admin-entity.component.scss',
  standalone: false,
})
export class AdminEntityComponent implements OnInit, OnDestroy {
  config!: AdminEntityConfig;
  records: GenericAdminRecord[] = [];
  searchSourceRecords: GenericAdminRecord[] = [];
  studentDocumentGroupRows: Array<{
    key: string;
    idMatricula: string;
    estudiante: string;
    cedula: string;
    proyecto: string;
    periodo: string;
    linkCarpeta: string;
    total: number;
    aprobados: number;
    pendientes: number;
    estado: string;
  }> = [];
  studentDocumentRecordGroups: Record<string, GenericAdminRecord[]> = {};
  formRecord: Record<string, any> = {};
  loading = false;
  saving = false;
  error = '';
  success = '';
  editingId: number | null = null;
  deletingId: number | null = null;
  changingStatusId: number | null = null;
  showForm = false;
  page = 0;
  pageSize = 10;
  totalRecords = 0;
  totalPages = 0;
  searchText = '';
  filterValues: Record<string, string> = {};
  searching = false;
  searchActive = false;
  fieldOptionChoices: Record<string, AdminFilterOption[]> = {};
  filterOptionChoices: Record<string, AdminFilterOption[]> = {};
  fieldOptionSearch: Record<string, string> = {};
  filterOptionSearch: Record<string, string> = {};
  openFieldComboKey = '';
  openFilterComboKey = '';
  expandedDocumentGroupKey = '';
  matriculaSortDirection: 'ASC' | 'DESC' = 'ASC';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private viewRefreshQueued = false;
  private destroyed = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly dataService: AdminDataService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.config = ADMIN_ENTITIES[data['entity']];
      this.page = 0;
      this.searchText = '';
      this.filterValues = {};
      this.searchActive = false;
      this.searchSourceRecords = [];
      this.fieldOptionChoices = {};
      this.filterOptionChoices = {};
      this.fieldOptionSearch = {};
      this.filterOptionSearch = {};
      this.openFieldComboKey = '';
      this.openFilterComboKey = '';
      this.expandedDocumentGroupKey = '';
      this.matriculaSortDirection = 'ASC';
      this.resetForm();
      this.loadFilterOptions();
      if (this.isStudentDocumentsView()) {
        this.loadFieldOptions();
      }
      this.loadRecords();
      this.refreshView();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  loadRecords(forceRefresh = false): void {
    this.loading = true;
    this.error = '';
    this.searchActive = false;
    this.refreshView();

    const requestedPageSize = this.isStudentDocumentsView() ? 1000 : this.pageSize;
    this.dataService.listPage<GenericAdminRecord>(
      this.config.endpoint,
      this.page,
      requestedPageSize,
      forceRefresh,
      this.listQueryParams()
    )
      .pipe(finalize(() => {
        this.loading = false;
        this.refreshView();
      }))
      .subscribe({
        next: result => {
          this.records = result.content || [];
          this.searchSourceRecords = this.records;
          this.rebuildStudentDocumentGroups();
          this.totalRecords = result.totalElements || 0;
          this.totalPages = result.totalPages || 0;
          this.page = result.number || 0;
          this.pageSize = result.size || this.pageSize;
          this.refreshView();
        },
        error: error => {
          this.records = [];
          this.rebuildStudentDocumentGroups();
          this.totalRecords = 0;
          this.totalPages = 0;
          this.error = this.resolveError(error, 'No se pudieron cargar los registros.');
          this.refreshView();
        },
      });
  }

  goToPage(nextPage: number): void {
    if (this.searchActive || nextPage < 0 || (this.totalPages > 0 && nextPage >= this.totalPages) || nextPage === this.page) {
      return;
    }

    this.page = nextPage;
    this.loadRecords();
  }

  onSearchTextChange(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => this.applySearchAndFilters(), 250);
  }

  clearSearch(): void {
    this.searchText = '';
    this.applySearchAndFilters();
  }

  onFilterChange(): void {
    this.applySearchAndFilters();
  }

  clearFilters(): void {
    this.filterValues = {};
    (this.config.filters || []).forEach(filter => this.syncFilterComboText(filter));
    this.applySearchAndFilters();
  }

  hasActiveFilters(): boolean {
    return Object.values(this.filterValues).some(value => this.normalizeSearchValue(value));
  }

  private applySearchAndFilters(): void {
    const term = this.normalizeSearchValue(this.searchText);
    const hasFilters = this.hasActiveFilters();

    if (!term && !hasFilters) {
      this.searchActive = false;
      this.searchSourceRecords = [];
      this.page = 0;
      this.loadRecords();
      return;
    }

    this.searching = true;
    this.error = '';
    this.success = '';
    this.refreshView();

    const requestedPageSize = this.isStudentDocumentsView() ? 1000 : 100;
    this.dataService.listPage<GenericAdminRecord>(this.config.endpoint, 0, requestedPageSize, true, this.listQueryParams())
      .pipe(finalize(() => {
        this.searching = false;
        this.refreshView();
      }))
      .subscribe({
        next: result => {
          this.searchSourceRecords = result.content || [];
          this.records = this.searchSourceRecords.filter(record => {
            const matchesSearch = term ? this.recordMatchesSearch(record, term) : true;
            const matchesFilters = this.recordMatchesFilters(record);
            return matchesSearch && matchesFilters;
          });
          this.rebuildStudentDocumentGroups();
          this.totalRecords = this.records.length;
          this.totalPages = this.records.length > 0 ? 1 : 0;
          this.page = 0;
          this.searchActive = true;
          this.refreshView();
        },
        error: error => {
          this.records = [];
          this.searchSourceRecords = [];
          this.rebuildStudentDocumentGroups();
          this.totalRecords = 0;
          this.totalPages = 0;
          this.searchActive = true;
          this.error = this.resolveError(error, 'No se pudo realizar la busqueda.');
          this.refreshView();
        },
      });
  }

  newRecord(): void {
    this.resetForm();
    this.showForm = true;
    this.loadFieldOptions(true);
    this.refreshView();
  }

  editRecord(record: GenericAdminRecord): void {
    this.editingId = Number(this.valueOf(record, this.config.idKey));
    this.formRecord = { ...record };
    this.syncFieldComboTexts();
      this.showForm = true;
      this.success = '';
      this.error = '';
      this.loadFieldOptions(true);
      this.scrollToForm();
      this.refreshView();
  }

  cancel(): void {
    this.resetForm();
    this.refreshView();
  }

  save(): void {
    this.openFieldComboKey = '';
    this.openFilterComboKey = '';

    const invalidSelect = this.config.fields.find(field =>
      field.type === 'select' && field.required && this.fieldVisible(field) && !this.formRecord[field.key]
    );
    if (invalidSelect) {
      this.error = `Seleccione una opcion valida en ${invalidSelect.label}.`;
      return;
    }

    this.saving = true;
    this.error = '';
    this.success = '';
    this.refreshView();
    const payload = this.payload();
    const request = this.editingId
      ? this.dataService.update(this.config.endpoint, this.editingId, payload)
      : this.dataService.create(this.config.endpoint, payload);

    request.pipe(
      timeout(15000),
      finalize(() => {
        this.saving = false;
        this.refreshView();
      })).subscribe({
      next: savedRecord => {
        this.success = this.editingId ? 'Registro actualizado correctamente.' : 'Registro creado correctamente.';
        this.resetForm();
        this.page = 0;
        this.loadRecords(true);
        this.refreshView();
      },
      error: error => {
        this.error = this.resolveError(error, 'No se pudo guardar el registro.');
        this.refreshView();
      },
    });
  }

  deleteRecord(record: GenericAdminRecord): void {
    const id = this.recordId(record);
    if (!id || !confirm('Deseas eliminar este registro?')) {
      return;
    }

    this.deletingId = id;
    this.error = '';
    this.success = '';
    this.refreshView();

    this.dataService.delete(this.config.endpoint, id)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.deletingId = null;
          this.refreshView();
        })
      )
      .subscribe({
        next: () => {
          this.success = 'Registro eliminado correctamente.';
          this.deletingId = null;
          this.records = this.records.filter(item => this.recordId(item) !== id);
          this.rebuildStudentDocumentGroups();
          this.totalRecords = Math.max(0, this.totalRecords - 1);

          if (this.records.length === 0 && this.page > 0) {
            this.page = this.page - 1;
          }

          this.loadRecords(true);
          this.refreshView();
        },
        error: error => {
          this.deletingId = null;
          this.error = this.resolveError(error, 'No se pudo eliminar el registro.');
          this.refreshView();
        },
      });
  }

  isDeleting(record: GenericAdminRecord): boolean {
    return this.deletingId !== null && this.recordId(record) === this.deletingId;
  }

  private recordId(record: GenericAdminRecord | Record<string, any>): number {
    return Number(this.valueOf(record, this.config.idKey));
  }

  valueOf(record: GenericAdminRecord | Record<string, any>, key: string): any {
    if (!record || !key) {
      return '';
    }

    if (key === 'progresoVinculacion') {
      return `${this.progressPercent(record)}%`;
    }

    return key.split('.').reduce<any>((current, segment) => {
      if (current && typeof current === 'object') {
        return current[segment];
      }
      return '';
    }, record);
  }

  displayValue(record: GenericAdminRecord | Record<string, any>, column: AdminField, rowIndex: number): any {
    if (column.label === '#') {
      if (this.isMatriculasProyectoView() && this.matriculaSortDirection === 'DESC') {
        return Math.max(1, this.totalRecords - ((this.page * this.pageSize) + rowIndex));
      }
      return (this.page * this.pageSize) + rowIndex + 1;
    }

    const value = this.valueOf(record, column.key);
    if (this.config.key === 'matriculas-proyecto' && column.key === 'estadoMatriculaProyecto') {
      return this.enrollmentStateLabel(value);
    }
    if (this.config.key === 'documentos' && column.key === 'asignacionDocumento') {
      return this.documentAssignmentLabel(value);
    }
    return value;
  }

  fieldVisible(field: AdminField): boolean {
    if (field.hidden) {
      return false;
    }

    if (!field.showWhenField) {
      return true;
    }

    const currentValue = this.formRecord[field.showWhenField];
    return (field.showWhenValues || []).some(value => String(value) === String(currentValue));
  }

  progressPercent(record: GenericAdminRecord | Record<string, any>): number {
    const total = Number(this.valueByPath(record as GenericAdminRecord, 'totalDocumentos') || 0);
    const aprobados = Number(this.valueByPath(record as GenericAdminRecord, 'documentosAprobados') || 0);
    if (total <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((aprobados / total) * 100)));
  }

  progressDetail(record: GenericAdminRecord | Record<string, any>): string {
    const aprobados = Number(this.valueByPath(record as GenericAdminRecord, 'documentosAprobados') || 0);
    const total = Number(this.valueByPath(record as GenericAdminRecord, 'totalDocumentos') || 0);
    return `${aprobados} / ${total} docs`;
  }

  isStudentDocumentsView(): boolean {
    return this.config?.key === 'estudiante-documentos';
  }

  isMatriculasProyectoView(): boolean {
    return this.config?.key === 'matriculas-proyecto';
  }

  toggleMatriculaSortDirection(): void {
    if (!this.isMatriculasProyectoView()) {
      return;
    }

    this.matriculaSortDirection = this.matriculaSortDirection === 'ASC' ? 'DESC' : 'ASC';
    this.page = 0;
    this.loadRecords(true);
  }

  matriculaSortLabel(): string {
    return this.matriculaSortDirection === 'ASC' ? 'Ascendente' : 'Descendente';
  }

  private listQueryParams(): Record<string, string> {
    return this.isMatriculasProyectoView() ? { sortDir: this.matriculaSortDirection } : {};
  }

  private rebuildStudentDocumentGroups(): void {
    if (!this.isStudentDocumentsView()) {
      this.studentDocumentGroupRows = [];
      this.studentDocumentRecordGroups = {};
      return;
    }

    const groups = new Map<string, GenericAdminRecord[]>();
    this.records.forEach(record => {
      const key = String(this.valueOf(record, 'idMatricula') || this.valueOf(record, 'matriculaProyecto.idMatricula') || '');
      if (!key) {
        return;
      }
      groups.set(key, [...(groups.get(key) || []), record]);
    });

    this.studentDocumentRecordGroups = Object.fromEntries(groups.entries());
    this.studentDocumentGroupRows = Array.from(groups.entries()).map(([key, documents]) => {
      const first = documents[0] || {};
      const aprobados = documents.filter(document => this.normalizeSearchValue(this.valueOf(document, 'estadoEstudianteDocumento')).includes('aprob')).length;
      const estadoGeneral = this.documentGroupStatus(documents);
      const pendientes = documents.filter(document => this.documentNeedsReview(document)).length;

      return {
        key,
        idMatricula: key,
        estudiante: this.valueOf(first, 'matriculaProyecto.estudiante.nombreEstudiante') || '-',
        cedula: this.valueOf(first, 'matriculaProyecto.estudiante.cedulaEstudiante') || '-',
        proyecto: this.valueOf(first, 'matriculaProyecto.proyecto.nombreProyecto') || '-',
        periodo: this.valueOf(first, 'matriculaProyecto.periodo.fechInicio') || '-',
        linkCarpeta: this.valueOf(first, 'matriculaProyecto.linkCarpeta') || this.valueOf(first, 'linkDocumento') || '-',
        total: documents.length,
        aprobados,
        pendientes,
        estado: estadoGeneral,
      };
    });

    if (this.expandedDocumentGroupKey && !this.studentDocumentRecordGroups[this.expandedDocumentGroupKey]) {
      this.expandedDocumentGroupKey = '';
    }
  }

  documentGroupRecords(groupKey: string): GenericAdminRecord[] {
    return this.studentDocumentRecordGroups[groupKey] || [];
  }

  private documentGroupStatus(documents: GenericAdminRecord[]): string {
    if (!documents.length) {
      return 'EN PROCESO';
    }

    const first = documents[0] || {};
    const manual = this.valueOf(first, 'matriculaProyecto.estudiante.estadoVinculacionManual');
    const estadoManual = this.valueOf(first, 'matriculaProyecto.estudiante.estadoVinculacion.nomEstado');
    if (manual === true || String(manual).toLowerCase() === 'true') {
      const estado = String(estadoManual || '').trim();
      if (estado) {
        return estado;
      }
    }

    const estados = documents.map(document => this.normalizeSearchValue(this.valueOf(document, 'estadoEstudianteDocumento')));
    const allApproved = estados.every(estado => estado.includes('aprob') && !estado.includes('desaprob'));
    if (allApproved) {
      return 'APROBADO';
    }

    const allRejected = estados.every(estado => estado.includes('rechaz') || estado.includes('desaprob'));
    if (allRejected) {
      return 'DESAPROBADO';
    }

    const hasOpen = estados.some(estado =>
      !estado
      || estado.includes('pend')
      || estado.includes('proceso')
      || (!estado.includes('aprob') && !estado.includes('rechaz') && !estado.includes('desaprob'))
    );
    if (hasOpen) {
      return 'EN PROCESO';
    }

    const hasRejected = estados.some(estado => estado.includes('rechaz') || estado.includes('desaprob'));
    return hasRejected ? 'RECHAZADO' : 'EN PROCESO';
  }

  private documentNeedsReview(document: GenericAdminRecord): boolean {
    const estado = this.normalizeSearchValue(this.valueOf(document, 'estadoEstudianteDocumento'));
    return !estado || estado.includes('pend');
  }

  toggleDocumentGroup(groupKey: string): void {
    this.expandedDocumentGroupKey = this.expandedDocumentGroupKey === groupKey ? '' : groupKey;
    this.refreshView();
  }

  isFolderLinkAvailable(link: string): boolean {
    const normalized = this.normalizeSearchValue(link);
    return Boolean(normalized && normalized !== '-' && normalized !== 'pendiente');
  }

  folderLinkHref(link: string): string {
    if (!link) {
      return '#';
    }
    return /^https?:\/\//i.test(link) ? link : `https://${link}`;
  }

  isLinkColumn(column: AdminField): boolean {
    return column.key.toLowerCase().includes('link');
  }

  isLinkAvailable(value: unknown): boolean {
    return this.isFolderLinkAvailable(String(value || ''));
  }

  linkHref(value: unknown): string {
    return this.folderLinkHref(String(value || ''));
  }

  linkDisplayLabel(columnOrLabel: AdminField | string): string {
    const label = typeof columnOrLabel === 'string' ? columnOrLabel : columnOrLabel.label;
    const normalizedLabel = this.normalizeSearchValue(label);
    const normalizedKey = typeof columnOrLabel === 'string' ? '' : this.normalizeSearchValue(columnOrLabel.key);
    const combined = `${normalizedLabel} ${normalizedKey}`;

    if (combined.includes('carpeta')) {
      return 'LINK DE CARPETA';
    }
    if (combined.includes('modelo')) {
      return 'LINK DE MODELO';
    }
    if (combined.includes('documento')) {
      return 'LINK DE DOCUMENTO';
    }
    if (combined.includes('archivo')) {
      return 'LINK DE ARCHIVO';
    }

    return 'LINK';
  }

  documentStatusOptions(): AdminFilterOption[] {
    const field = this.config.fields.find(item => item.key === 'estadoEstudianteDocumento');
    if (!field) {
      return [];
    }
    return this.rawFieldOptions(field);
  }

  isChangingStatus(record: GenericAdminRecord): boolean {
    return this.changingStatusId !== null && this.recordId(record) === this.changingStatusId;
  }

  updateStudentDocumentStatus(record: GenericAdminRecord, nextStatus: string): void {
    const id = this.recordId(record);
    if (!id || !nextStatus || String(this.valueOf(record, 'estadoEstudianteDocumento')) === String(nextStatus)) {
      return;
    }

    this.changingStatusId = id;
    this.error = '';
    this.success = '';
    this.refreshView();

    this.dataService.updateStudentDocumentStatus(id, nextStatus)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.changingStatusId = null;
          this.refreshView();
        })
      )
      .subscribe({
        next: updated => {
          this.records = this.records.map(item => this.recordId(item) === id ? { ...item, ...updated } : item);
          this.rebuildStudentDocumentGroups();
          this.success = 'Estado actualizado correctamente.';
          this.refreshView();
        },
        error: error => {
          this.error = this.resolveError(error, 'No se pudo actualizar el estado del documento.');
          this.refreshView();
        },
      });
  }

  fieldPlaceholder(field: AdminField): string {
    return field.label.toLowerCase().includes('nombre') ? '' : (field.placeholder || '');
  }

  fieldOptions(field: AdminField): AdminFilterOption[] {
    const search = this.effectiveFieldComboSearch(field);
    if (field.options) {
      return this.filterSelectOptions(field.options, search, this.formRecord[field.key]);
    }

    const currentValue = this.formRecord[field.key];
    const choices = (this.fieldOptionChoices[field.key] || [])
      .filter(option => !option.inactive || String(option.value) === String(currentValue));
    const parentChoices = !field.optionParentKey || !field.dependsOnField
      ? choices
      : choices.filter(option => String(option.parentValue) === String(this.formRecord[field.dependsOnField!]));

    return this.filterSelectOptions(parentChoices, search, currentValue);
  }

  fieldDependsOnMissingValue(field: AdminField): boolean {
    return Boolean(field.dependsOnField && !this.formRecord[field.dependsOnField]);
  }

  fieldSelectPlaceholder(field: AdminField): string {
    if (field.dependsOnField && !this.formRecord[field.dependsOnField]) {
      const dependency = this.config.fields.find(item => item.key === field.dependsOnField);
      return `Seleccione primero ${dependency?.label || 'el campo anterior'}`;
    }
    return 'Seleccione una opcion';
  }

  filterOptions(filter: { key: string; options?: AdminFilterOption[] }): AdminFilterOption[] {
    const options = filter.options || this.filterOptionChoices[filter.key] || [{ label: 'Todos', value: '' }];
    return this.filterSelectOptions(options, this.effectiveFilterComboSearch(filter), this.filterValues[filter.key], true);
  }

  comboListId(kind: 'field' | 'filter', key: string): string {
    return `${kind}-combo-${this.config.key}-${key}`;
  }

  fieldComboText(field: AdminField): string {
    if (this.fieldOptionSearch[field.key] !== undefined) {
      return this.fieldOptionSearch[field.key];
    }
    return this.selectedOptionLabel(field);
  }

  filterComboText(filter: { key: string; options?: AdminFilterOption[] }): string {
    if (this.filterOptionSearch[filter.key] !== undefined) {
      return this.filterOptionSearch[filter.key];
    }
    const selected = this.rawFilterOptions(filter).find(option => String(option.value) === String(this.filterValues[filter.key] || ''));
    return selected?.label || '';
  }

  selectedOptionLabel(field: AdminField): string {
    const selected = this.rawFieldOptions(field).find(option => String(option.value) === String(this.formRecord[field.key]));
    return selected?.label || '';
  }

  onFieldComboInput(field: AdminField, value: string): void {
    this.openFieldComboKey = field.key;
    this.fieldOptionSearch[field.key] = value;
    const option = this.findOptionByText(this.rawFieldOptions(field), value);
    const previousValue = this.formRecord[field.key];
    this.formRecord[field.key] = option ? option.value : '';

    if (String(previousValue) !== String(this.formRecord[field.key])) {
      this.onFormFieldChange(field);
    }
  }

  onFieldComboBlur(field: AdminField): void {
    setTimeout(() => {
      const option = this.findOptionByText(this.rawFieldOptions(field), this.fieldOptionSearch[field.key]);
      const previousValue = this.formRecord[field.key];
      if (option) {
        this.formRecord[field.key] = option.value;
        this.fieldOptionSearch[field.key] = option.label;
      } else if (!this.fieldOptionSearch[field.key]) {
        this.formRecord[field.key] = '';
      }
      if (String(previousValue) !== String(this.formRecord[field.key])) {
        this.onFormFieldChange(field);
      }
      this.openFieldComboKey = '';
    }, 120);
  }

  onFilterComboInput(filter: { key: string; options?: AdminFilterOption[] }, value: string): void {
    this.openFilterComboKey = filter.key;
    this.filterOptionSearch[filter.key] = value;
    const option = this.findOptionByText(this.rawFilterOptions(filter), value);
    this.filterValues[filter.key] = option ? String(option.value) : '';
    this.onFilterChange();
  }

  onFilterComboBlur(filter: { key: string; options?: AdminFilterOption[] }): void {
    setTimeout(() => {
      const option = this.findOptionByText(this.rawFilterOptions(filter), this.filterOptionSearch[filter.key]);
      if (option) {
        this.filterValues[filter.key] = String(option.value);
        this.filterOptionSearch[filter.key] = option.label;
      }
      this.openFilterComboKey = '';
    }, 120);
  }

  openFieldCombo(field: AdminField): void {
    if (!this.fieldDependsOnMissingValue(field)) {
      this.openFieldComboKey = field.key;
    }
  }

  openFilterCombo(filter: { key: string }): void {
    this.openFilterComboKey = filter.key;
  }

  selectFieldOption(field: AdminField, option: AdminFilterOption): void {
    this.formRecord[field.key] = option.value;
    this.fieldOptionSearch[field.key] = option.label;
    this.openFieldComboKey = '';
    this.onFormFieldChange(field);
  }

  selectFilterOption(filter: { key: string }, option: AdminFilterOption): void {
    this.filterValues[filter.key] = String(option.value);
    this.filterOptionSearch[filter.key] = option.label;
    this.openFilterComboKey = '';
    this.onFilterChange();
  }

  onFormFieldChange(changedField: AdminField): void {
    this.config.fields
      .filter(field => field.dependsOnField === changedField.key)
      .forEach(field => {
        this.formRecord[field.key] = '';
        this.fieldOptionSearch[field.key] = '';
      });

    this.config.fields
      .filter(field => field.showWhenField === changedField.key && !this.fieldVisible(field))
      .forEach(field => {
        this.formRecord[field.key] = '';
        this.fieldOptionSearch[field.key] = '';
      });

    this.applyMatriculaProyectoAutofill(changedField);
    this.applyProyectoPeriodoAutofill(changedField);
  }

  onFieldOptionSearchChange(field: AdminField): void {
    if (!this.formRecord[field.key]) {
      return;
    }

    const selectedLabel = this.normalizeSearchValue(this.selectedOptionLabel(field));
    const searchValue = this.normalizeSearchValue(this.fieldOptionSearch[field.key]);
    if (searchValue && !selectedLabel.includes(searchValue)) {
      this.formRecord[field.key] = '';
      this.onFormFieldChange(field);
    }
  }

  private loadFieldOptions(forceRefresh = false): void {
    this.config.fields
      .filter(field => field.optionsEndpoint)
      .forEach(field => {
        this.dataService.listAll<GenericAdminRecord>(field.optionsEndpoint!, forceRefresh)
          .subscribe({
            next: records => {
              const sourceConfig = ADMIN_ENTITIES[field.optionsEndpoint!];
              this.fieldOptionChoices[field.key] = (records || []).map(record => ({
                value: field.optionValueKeys?.length
                  ? field.optionValueKeys
                    .map(key => this.valueOf(record, key))
                    .filter(value => value !== null && value !== undefined && value !== '')
                    .join(' ')
                  : this.valueOf(record, field.optionValueKey || 'id'),
                label: (field.optionLabelKeys || [])
                  .map(key => this.valueOf(record, key))
                  .filter(value => value !== null && value !== undefined && value !== '')
                  .join(' - '),
                parentValue: field.optionParentKey
                  ? this.valueOf(record, field.optionParentKey)
                  : undefined,
                inactive: sourceConfig?.statusKey
                  ? this.isInactiveStatus(this.valueOf(record, sourceConfig.statusKey))
                  : false,
                source: record,
              }));
              this.syncFieldComboText(field);
              this.applyDeferredMatriculaProyectoAutofill(field.key);
              this.applyDeferredProyectoPeriodoAutofill(field.key);
              this.refreshView();
            },
            error: error => {
              this.error = this.resolveError(error, `No se pudieron cargar las opciones de ${field.label}.`);
              this.refreshView();
            },
          });
      });
  }

  private rawFieldOptions(field: AdminField): AdminFilterOption[] {
    if (field.options) {
      return field.options;
    }

    const currentValue = this.formRecord[field.key];
    const choices = (this.fieldOptionChoices[field.key] || [])
      .filter(option => !option.inactive || String(option.value) === String(currentValue));

    if (!field.optionParentKey || !field.dependsOnField) {
      return choices;
    }

    const parentValue = this.formRecord[field.dependsOnField];
    return choices.filter(option => String(option.parentValue) === String(parentValue));
  }

  private rawFilterOptions(filter: { key: string; options?: AdminFilterOption[] }): AdminFilterOption[] {
    return filter.options || this.filterOptionChoices[filter.key] || [{ label: 'Todos', value: '' }];
  }

  private filterSelectOptions(
    options: AdminFilterOption[],
    search: string | undefined,
    currentValue?: unknown,
    keepBlank = false
  ): AdminFilterOption[] {
    const term = this.normalizeSearchValue(search);
    if (!term) {
      return options;
    }

    return options.filter(option => {
      const isCurrent = currentValue !== undefined && String(option.value) === String(currentValue);
      const isBlank = keepBlank && option.value === '';
      return isCurrent || isBlank || this.normalizeSearchValue(option.label).includes(term);
    });
  }

  private effectiveFieldComboSearch(field: AdminField): string {
    const search = this.fieldOptionSearch[field.key] || '';
    if (this.openFieldComboKey !== field.key) {
      return search;
    }

    const selectedLabel = this.selectedOptionLabel(field);
    return this.normalizeSearchValue(search) === this.normalizeSearchValue(selectedLabel) ? '' : search;
  }

  private effectiveFilterComboSearch(filter: { key: string; options?: AdminFilterOption[] }): string {
    const search = this.filterOptionSearch[filter.key] || '';
    if (this.openFilterComboKey !== filter.key) {
      return search;
    }

    const selected = this.rawFilterOptions(filter).find(option => String(option.value) === String(this.filterValues[filter.key] || ''));
    return this.normalizeSearchValue(search) === this.normalizeSearchValue(selected?.label) ? '' : search;
  }

  private findOptionByText(options: AdminFilterOption[], text: string | undefined): AdminFilterOption | undefined {
    const normalizedText = this.normalizeSearchValue(text);
    if (!normalizedText) {
      return options.find(option => option.value === '');
    }

    return options.find(option =>
      this.normalizeSearchValue(option.label) === normalizedText
      || this.normalizeSearchValue(option.value) === normalizedText
    );
  }

  private syncFieldComboTexts(): void {
    this.config.fields
      .filter(field => field.type === 'select')
      .forEach(field => this.syncFieldComboText(field));
  }

  private syncFieldComboText(field: AdminField): void {
    if (!this.formRecord[field.key]) {
      this.fieldOptionSearch[field.key] = '';
      return;
    }

    const selected = this.rawFieldOptions(field).find(option => String(option.value) === String(this.formRecord[field.key]));
    this.fieldOptionSearch[field.key] = selected?.label || String(this.formRecord[field.key] || '');
  }

  private applyMatriculaProyectoAutofill(changedField: AdminField): void {
    if (this.config.key !== 'matriculas-proyecto') {
      return;
    }

    if (changedField.key === 'idEstudiante') {
      const estudiante = this.selectedFieldSource('idEstudiante');
      if (!estudiante) {
        return;
      }

      const cicloId = this.valueOf(estudiante, 'idCiclo');
      if (cicloId) {
        this.setFormFieldValue('idCiclo', cicloId);
      }

      return;
    }

    if (changedField.key === 'idProyecto') {
      const proyecto = this.selectedFieldSource('idProyecto');
      if (!proyecto) {
        return;
      }

      this.applyProjectPeriodToEnrollment(proyecto);

      const idTutorProyecto = this.valueOf(proyecto || {}, 'idTutor');
      if (idTutorProyecto) {
        this.setFormFieldValue('idTutor', idTutorProyecto);
        return;
      }

      const tutorOption = this.findTutorOptionForProject(proyecto);
      if (!tutorOption) {
        return;
      }

      this.formRecord['idTutor'] = tutorOption.value;
      this.fieldOptionSearch['idTutor'] = tutorOption.label;
    }
  }

  private findTutorOptionForProject(proyecto: GenericAdminRecord): AdminFilterOption | undefined {
    const tutorProyecto = this.normalizeSearchValue(this.valueOf(proyecto || {}, 'tutorProyecto'));
    if (!tutorProyecto) {
      return undefined;
    }

    const tutorProyectoTokens = this.searchTokens(tutorProyecto);
    return (this.fieldOptionChoices['idTutor'] || []).find(option => {
      const nombreTutor = this.normalizeSearchValue(this.valueOf(option.source || {}, 'nombreTutor'));
      const cedulaTutor = this.normalizeSearchValue(this.valueOf(option.source || {}, 'cedulaTutor'));
      const correoTutor = this.normalizeSearchValue(this.valueOf(option.source || {}, 'correoTutor'));
      const label = this.normalizeSearchValue(option.label);
      const value = this.normalizeSearchValue(option.value);
      const hayCoincidenciaDirecta = [nombreTutor, cedulaTutor, correoTutor, label, value]
        .filter(Boolean)
        .some(candidate =>
          candidate === tutorProyecto
          || candidate.includes(tutorProyecto)
          || tutorProyecto.includes(candidate)
        );

      if (hayCoincidenciaDirecta) {
        return true;
      }

      if (!tutorProyectoTokens.length) {
        return false;
      }

      const optionText = `${nombreTutor} ${cedulaTutor} ${correoTutor} ${label}`;
      return tutorProyectoTokens.every(token => optionText.includes(token));
    });
  }

  private searchTokens(value: string): string[] {
    return value
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length > 1);
  }

  private applyDeferredMatriculaProyectoAutofill(loadedFieldKey: string): void {
    if (this.config.key !== 'matriculas-proyecto') {
      return;
    }

    if ((loadedFieldKey === 'idTutor' || loadedFieldKey === 'idProyecto') && this.formRecord['idProyecto'] && !this.formRecord['idTutor']) {
      this.applyMatriculaProyectoAutofill({ key: 'idProyecto' } as AdminField);
    }

    if ((loadedFieldKey === 'idPeriodo' || loadedFieldKey === 'idProyecto') && this.formRecord['idProyecto'] && !this.formRecord['idPeriodo']) {
      this.applyMatriculaProyectoAutofill({ key: 'idProyecto' } as AdminField);
    }

    if ((loadedFieldKey === 'idEstudiante' || loadedFieldKey === 'idCiclo') && this.formRecord['idEstudiante']) {
      this.applyMatriculaProyectoAutofill({ key: 'idEstudiante' } as AdminField);
    }
  }

  private applyProyectoPeriodoAutofill(changedField: AdminField): void {
    if (this.config.key !== 'proyectos' || changedField.key !== 'idPeriodoProyecto') {
      return;
    }

    const periodo = this.selectedFieldSource('idPeriodoProyecto');
    if (!periodo) {
      this.formRecord['fechaInicioP'] = '';
      this.formRecord['fechaFinP'] = '';
      return;
    }

    this.formRecord['fechaInicioP'] = this.toDateInputValue(this.valueOf(periodo, 'fechInicio'));
    this.formRecord['fechaFinP'] = this.toDateInputValue(this.valueOf(periodo, 'fechFin'));
  }

  private applyDeferredProyectoPeriodoAutofill(loadedFieldKey: string): void {
    if (this.config.key !== 'proyectos' || loadedFieldKey !== 'idPeriodoProyecto') {
      return;
    }

    if (this.formRecord['idPeriodoProyecto']) {
      this.applyProyectoPeriodoAutofill({ key: 'idPeriodoProyecto' } as AdminField);
      return;
    }

    const fechaInicio = this.toDateInputValue(this.formRecord['fechaInicioP']);
    const fechaFin = this.toDateInputValue(this.formRecord['fechaFinP']);
    if (!fechaInicio || !fechaFin) {
      return;
    }

    const periodoOption = (this.fieldOptionChoices['idPeriodoProyecto'] || []).find(option =>
      this.toDateInputValue(this.valueOf(option.source || {}, 'fechInicio')) === fechaInicio
      && this.toDateInputValue(this.valueOf(option.source || {}, 'fechFin')) === fechaFin
    );

    if (periodoOption) {
      this.formRecord['idPeriodoProyecto'] = periodoOption.value;
      this.fieldOptionSearch['idPeriodoProyecto'] = periodoOption.label;
    }
  }

  private selectedFieldSource(fieldKey: string): GenericAdminRecord | undefined {
    const field = this.config.fields.find(item => item.key === fieldKey);
    if (!field) {
      return undefined;
    }

    return this.rawFieldOptions(field)
      .find(option => String(option.value) === String(this.formRecord[fieldKey]))
      ?.source;
  }

  private applyProjectPeriodToEnrollment(proyecto: GenericAdminRecord): void {
    const directPeriodId = this.valueOf(proyecto, 'idPeriodoProyecto');
    if (directPeriodId) {
      this.setFormFieldValue('idPeriodo', directPeriodId);
      return;
    }

    const projectStart = this.toDateInputValue(this.valueOf(proyecto, 'fechaInicioP'));
    const projectEnd = this.toDateInputValue(this.valueOf(proyecto, 'fechaFinP'));
    if (!projectStart || !projectEnd) {
      return;
    }

    const periodOption = (this.fieldOptionChoices['idPeriodo'] || []).find(option =>
      this.toDateInputValue(this.valueOf(option.source || {}, 'fechInicio')) === projectStart
      && this.toDateInputValue(this.valueOf(option.source || {}, 'fechFin')) === projectEnd
    );

    if (periodOption) {
      this.formRecord['idPeriodo'] = periodOption.value;
      this.fieldOptionSearch['idPeriodo'] = periodOption.label;
    }
  }

  private setFormFieldValue(fieldKey: string, value: unknown): void {
    this.formRecord[fieldKey] = value;
    const field = this.config.fields.find(item => item.key === fieldKey);
    if (field?.type === 'select') {
      this.syncFieldComboText(field);
    }
  }

  private toDateInputValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const raw = String(value);
    const dateMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
    return dateMatch ? dateMatch[0] : raw;
  }

  private syncFilterComboText(filter: { key: string; options?: AdminFilterOption[] }): void {
    const selected = this.rawFilterOptions(filter).find(option => String(option.value) === String(this.filterValues[filter.key] || ''));
    this.filterOptionSearch[filter.key] = selected?.label || '';
  }

  private loadFilterOptions(forceRefresh = false): void {
    (this.config.filters || [])
      .filter(filter => filter.optionsEndpoint)
      .forEach(filter => {
        this.dataService.listAll<GenericAdminRecord>(filter.optionsEndpoint!, forceRefresh)
          .subscribe({
            next: records => {
              this.filterOptionChoices[filter.key] = [
                { label: 'Todos', value: '' },
                ...(records || []).map(record => ({
                  value: filter.optionValueKeys?.length
                    ? filter.optionValueKeys
                      .map(key => this.valueOf(record, key))
                      .filter(value => value !== null && value !== undefined && value !== '')
                      .join(' ')
                    : this.valueOf(record, filter.optionValueKey || 'id'),
                  label: (filter.optionLabelKeys || [])
                    .map(key => this.valueOf(record, key))
                    .filter(value => value !== null && value !== undefined && value !== '')
                    .join(' - '),
                })),
              ];
              this.syncFilterComboText(filter);
              this.refreshView();
            },
            error: error => {
              this.error = this.resolveError(error, `No se pudieron cargar las opciones de ${filter.label}.`);
              this.refreshView();
            },
          });
      });
  }

  private recordMatchesSearch(record: GenericAdminRecord, term: string): boolean {
    return this.searchFields().some(field => this.normalizeSearchValue(this.valueByPath(record, field)).includes(term));
  }

  private recordMatchesFilters(record: GenericAdminRecord): boolean {
    return (this.config.filters || []).every(filter => {
      const rawFilterValue = this.filterValues[filter.key];
      const filterValue = this.normalizeSearchValue(rawFilterValue);

      if (!filterValue) {
        return true;
      }

      return filter.fields.some(field => {
        const fieldValue = this.normalizeSearchValue(this.valueByPath(record, field));
        return filter.type === 'select' ? fieldValue === filterValue : fieldValue.includes(filterValue);
      });
    });
  }

  private searchFields(): string[] {
    if (this.config.searchFields?.length) {
      return this.config.searchFields;
    }

    return Array.from(new Set([
      ...this.config.columns.map(column => column.key),
      ...this.config.fields.map(field => field.key),
    ]));
  }

  private valueByPath(record: GenericAdminRecord, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[segment];
      }

      return '';
    }, record);
  }

  private normalizeSearchValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return Object.values(value as Record<string, unknown>)
        .map(item => this.normalizeSearchValue(item))
        .join(' ');
    }

    const raw = String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const monthNames = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    const dateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!dateMatch) {
      return raw;
    }

    const monthIndex = Number(dateMatch[2]) - 1;
    const monthName = monthNames[monthIndex] || '';
    return `${raw} ${dateMatch[1]} ${dateMatch[2]} ${monthName}`;
  }

  statusClass(value: unknown): string {
    const text = this.normalizeSearchValue(value);
    if (text.includes('rechaz') || text.includes('desaprob')) return 'bg-danger';
    if (text.includes('inactivo') || text.includes('inactiva') || text.includes('cerr')) return 'bg-secondary';
    if (text.includes('pend') || text.includes('en curso') || text.includes('proceso')) return 'bg-warning text-dark';
    if (text.includes('activo') || text.includes('activa') || text.includes('aprob')) return 'bg-success';
    return 'bg-primary';
  }

  isStatusColumn(column: AdminField): boolean {
    return column.key === this.config.statusKey || column.key.toLowerCase().includes('estado');
  }

  private enrollmentStateLabel(value: unknown): string {
    const text = this.normalizeSearchValue(value);
    if (text.includes('inactivo') || text.includes('inactiva') || text.includes('cerr')) {
      return 'Cerrada';
    }
    if (text.includes('activo') || text.includes('activa') || text.includes('abiert')) {
      return 'Abierta';
    }
    return String(value || '');
  }

  private documentAssignmentLabel(value: unknown): string {
    const text = this.normalizeSearchValue(value);
    if (text === 'ninguno') return 'No asignar';
    if (text === 'todos' || !text) return 'Todos';
    if (text === 'carrera') return 'Por carrera';
    if (text === 'ciclo') return 'Por ciclo';
    if (text === 'carrera_ciclo') return 'Por carrera y ciclo';
    return String(value || '');
  }

  statusSelectClass(value: unknown): string {
    const text = this.normalizeSearchValue(value);
    if (text.includes('rechaz') || text.includes('desaprob')) return 'admin-status-select-danger';
    if (text.includes('inactivo') || text.includes('inactiva') || text.includes('cerr')) return 'admin-status-select-muted';
    if (text.includes('pend') || text.includes('en curso') || text.includes('proceso')) return 'admin-status-select-warning';
    if (text.includes('activo') || text.includes('activa') || text.includes('aprob')) return 'admin-status-select-success';
    return 'admin-status-select-primary';
  }

  private isInactiveStatus(value: unknown): boolean {
    const text = this.normalizeSearchValue(value);
    return text === 'inactivo' || text === 'inactiva';
  }

  private resetForm(): void {
    this.editingId = null;
    this.formRecord = { ...this.config.emptyRecord };
    this.syncFieldComboTexts();
    this.showForm = false;
  }

  private payload(): GenericAdminRecord {
    const payload: Record<string, any> = {};
    this.config.fields.forEach(field => {
      payload[field.key] = this.formRecord[field.key];
    });

    this.config.fields.forEach(field => {
      if ((field.type === 'number' || field.optionValueType === 'number')
          && payload[field.key] !== '' && payload[field.key] !== null) {
        payload[field.key] = Number(payload[field.key]);
      }
    });

    return payload as GenericAdminRecord;
  }

  private refreshView(): void {
    if (this.viewRefreshQueued || this.destroyed) {
      return;
    }

    this.viewRefreshQueued = true;
    queueMicrotask(() => {
      this.viewRefreshQueued = false;
      if (this.destroyed) {
        return;
      }

      this.changeDetector.detectChanges();
    });
  }

  private scrollToForm(): void {
    setTimeout(() => {
      const form = document.getElementById('admin-record-form');
      form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  private resolveError(error: any, fallback: string): string {
    const rawMessage = String(error?.message || '');

    if (rawMessage.includes('Http failure during parsing') || rawMessage.includes('Unexpected token')) {
      return 'La API no devolvio JSON. Verifica que el backend este corriendo y que el frontend haya sido iniciado con npm start para activar el proxy.';
    }

    if (error?.name === 'TimeoutError' || rawMessage.toLowerCase().includes('timeout')) {
      return 'La API tardo demasiado en responder. Verifica que el backend este corriendo y revisa si el registro se guardo antes de intentar nuevamente.';
    }

    if (error?.error?.validations) {
      return Object.entries(error.error.validations as Record<string, string>)
        .map(([field, message]) => `${field}: ${message}`)
        .join(' ');
    }
    if (error?.error?.message) {
      const title = error?.error?.error;
      return title ? `${title}: ${error.error.message}` : error.error.message;
    }
    if (typeof error?.error === 'string') return error.error;
    if (rawMessage) return rawMessage;
    return fallback;
  }
}
