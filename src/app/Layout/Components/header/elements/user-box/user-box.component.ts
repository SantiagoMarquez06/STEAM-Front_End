import { Component } from '@angular/core';
import { ThemeOptions } from '../../../../../theme-options';
import { AuthService, CurrentUser } from '../../../../../core/auth/auth.service';

@Component({
  selector: 'app-user-box',
  templateUrl: './user-box.component.html',
  standalone: false,
  styles: [`
    .steam-profile-icon {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #eaf6fb;
      color: #004b85;
      border: 1px solid #c9e8f3;
      font-size: 1.45rem;
    }

    .steam-profile-icon-lg {
      width: 58px;
      height: 58px;
      font-size: 2rem;
      margin: 0 auto 0.5rem;
    }
  `]
})
export class UserBoxComponent {
  user: CurrentUser;

  constructor(
    public globals: ThemeOptions,
    private readonly authService: AuthService
  ) {
    this.user = this.authService.getCurrentUser();
  }

  logout(): void {
    this.authService.logout();
  }
}
