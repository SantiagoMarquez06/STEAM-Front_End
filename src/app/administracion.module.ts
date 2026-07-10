import { NgModule } from '@angular/core';
import { SharedModule } from './shared.module';
import { AdminEntityComponent } from './Administracion/admin-entity/admin-entity.component';
import { AdminDataService } from './Administracion/admin-data.service';
import { ReportesComponent } from './Reportes/reportes.component';
import { CargarInformacionComponent } from './CargarInformacion/cargar-informacion.component';

@NgModule({
  declarations: [
    AdminEntityComponent,
    ReportesComponent,
    CargarInformacionComponent
  ],
  imports: [
    SharedModule
  ],
  providers: [
    AdminDataService
  ],
  exports: [
    AdminEntityComponent,
    ReportesComponent,
    CargarInformacionComponent
  ]
})
export class AdministracionModule { }
