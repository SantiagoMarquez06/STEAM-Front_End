import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password-boxed',
  templateUrl: './forgot-password-boxed.component.html',
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
  `]
})
export class ForgotPasswordBoxedComponent {
  loading = false;
  successMessage = '';
  errorMessage = '';

  constructor(private readonly authService: AuthService) { }

  onSubmit(form: NgForm) {
    if (form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.authService.recuperarClave(form.value.email).subscribe({
      next: response => {
        this.successMessage = response?.message || 'Solicitud procesada. Revisa tu correo.';
        form.resetForm();
      },
      error: error => {
        this.errorMessage = error?.error?.message || error?.error || 'No se pudo recuperar la clave. Verifica el correo ingresado.';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

}
