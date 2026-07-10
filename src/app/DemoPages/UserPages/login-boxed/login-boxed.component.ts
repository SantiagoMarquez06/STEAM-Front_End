import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login-boxed',
  templateUrl: './login-boxed.component.html',
  standalone: false,
  styles: [`
    .steam-login-bg {
      background:
        radial-gradient(circle at top left, rgba(0, 178, 169, 0.28), transparent 34%),
        linear-gradient(135deg, #003c71 0%, #005b96 48%, #00a884 100%);
    }

    .steam-login-brand {
      color: #ffffff;
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: 0.18rem;
      text-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
    }

    .card {
      border-radius: 0.55rem;
    }

    .btn-primary {
      background-color: #004b85;
      border-color: #004b85;
    }

    .btn-primary:hover,
    .btn-primary:focus {
      background-color: #003c71;
      border-color: #003c71;
    }

    .steam-password-overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(0, 35, 66, 0.68);
      backdrop-filter: blur(4px);
    }

    .steam-password-card {
      width: 100%;
      max-width: 460px;
      border-radius: 0.55rem;
    }
  `]
})
export class LoginBoxedComponent implements OnDestroy {
  loading = false;
  changingPassword = false;
  showPasswordChange = false;
  errorMessage = '';
  passwordChangeError = '';
  private viewRefreshQueued = false;
  private destroyed = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) { }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  onSubmit(form: NgForm) {
    if (form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.refreshView();

    const { username, password } = form.value;

    this.authService.login(username, password)
      .pipe(
        timeout(20000),
        finalize(() => {
          this.loading = false;
          this.refreshView();
        })
      )
      .subscribe({
      next: response => {
        if (response.requiereCambioClave) {
          this.showPasswordChange = true;
          this.refreshView();
          return;
        }
        this.router.navigate(['/dashboards/analytics']);
      },
      error: (error) => {
        this.errorMessage = error?.name === 'TimeoutError'
          ? 'El inicio de sesion tardo demasiado. Revisa si el backend esta respondiendo.'
          : error?.error?.message || 'No se pudo iniciar sesion. Revisa tus credenciales.';
        this.refreshView();
      }
    });
  }

  cambiarClave(form: NgForm) {
    if (this.changingPassword) {
      return;
    }

    if (form.invalid) {
      this.passwordChangeError = 'La nueva contrasena debe tener al menos 6 caracteres y debes confirmarla.';
      this.refreshView();
      return;
    }

    const { nuevaClave, confirmarClave } = form.value;
    if (!nuevaClave || nuevaClave.trim().length < 6) {
      this.passwordChangeError = 'La nueva contrasena debe tener al menos 6 caracteres.';
      this.refreshView();
      return;
    }

    if (nuevaClave !== confirmarClave) {
      this.passwordChangeError = 'Las contrasenas no coinciden.';
      this.refreshView();
      return;
    }

    this.changingPassword = true;
    this.passwordChangeError = '';
    this.refreshView();

    this.authService.cambiarClave(nuevaClave.trim())
      .pipe(
        timeout(20000),
        finalize(() => {
          this.changingPassword = false;
          this.refreshView();
        })
      )
      .subscribe({
      next: () => {
        this.showPasswordChange = false;
        this.router.navigate(['/dashboards/analytics']);
      },
      error: error => {
        this.passwordChangeError = error?.name === 'TimeoutError'
          ? 'La actualizacion tardo demasiado. Intenta nuevamente.'
          : error?.error?.message || error?.error || 'No se pudo actualizar la contrasena.';
        this.refreshView();
      }
    });
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
