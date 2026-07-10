import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import {
  AdminDataService,
  DashboardProgress
} from '../../../Administracion/admin-data.service';

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  standalone: false
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  heading = 'Dashboard STEAM';
  subheading = 'Resumen operativo de vinculacion y registros que requieren atencion.';
  icon = 'pe-7s-graph1 icon-gradient bg-grow-early';

  loading = true;
  error = '';
  totalStudents = 0;
  activeProjects = 0;
  totalEnrollments = 0;
  pendingDocuments = 0;
  averageProgress = 0;
  completedStudents = 0;
  studentsAtRisk = 0;
  progressRecords: DashboardProgress[] = [];
  private viewRefreshQueued = false;
  private destroyed = false;

  constructor(
    private readonly dataService: AdminDataService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = '';
    this.refreshView();

    this.dataService.getDashboardSummary()
      .pipe(
        timeout(15000),
        finalize(() => {
          this.loading = false;
          this.refreshView();
        })
      )
      .subscribe({
      next: result => {
        this.totalStudents = result.totalStudents;
        this.activeProjects = result.activeProjects;
        this.totalEnrollments = result.totalEnrollments;
        this.pendingDocuments = result.pendingDocuments;
        this.averageProgress = result.averageProgress;
        this.completedStudents = result.completedStudents;
        this.studentsAtRisk = result.studentsAtRisk;
        this.progressRecords = result.progressRecords;
        this.refreshView();
      },
      error: error => {
        this.error = error?.error?.message || 'No se pudo cargar la informacion del dashboard.';
        this.refreshView();
      }
    });
  }

  progressClass(progress: number): string {
    if (progress >= 75) return 'bg-success';
    if (progress >= 40) return 'bg-warning';
    return 'bg-danger';
  }

  private refreshView(): void {
    if (this.destroyed || this.viewRefreshQueued) {
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
