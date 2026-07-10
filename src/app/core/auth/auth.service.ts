import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

interface LoginResponse {
  token: string;
  username?: string;
  nombre?: string;
  correo?: string;
  requiereCambioClave?: boolean;
}

export interface CurrentUser {
  username: string;
  nombre: string;
  correo: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'token';
  private readonly userKey = 'currentUser';

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/login', { username, password }).pipe(
      tap((response) => {
        this.setToken(response.token);
        this.setCurrentUser({
          username: response.username || username,
          nombre: response.nombre || response.username || username,
          correo: response.correo || ''
        });
      })
    );
  }

  recuperarClave(correo: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/login/recuperar-clave', { correo });
  }

  cambiarClave(nuevaClave: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/auth/cambiar-clave', { nuevaClave });
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  getCurrentUser(): CurrentUser {
    const saved = localStorage.getItem(this.userKey);
    if (saved) {
      try {
        const user = JSON.parse(saved) as CurrentUser;
        return {
          username: user.username || 'usuario',
          nombre: user.nombre || user.username || 'Usuario',
          correo: user.correo || ''
        };
      } catch {
        localStorage.removeItem(this.userKey);
      }
    }
    return { username: 'usuario', nombre: 'Usuario', correo: '' };
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  private setCurrentUser(user: CurrentUser): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }
}
