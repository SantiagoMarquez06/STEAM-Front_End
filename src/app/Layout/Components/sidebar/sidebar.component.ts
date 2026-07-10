import {Component, HostListener, OnInit, afterNextRender} from '@angular/core';
import {ThemeOptions} from '../../../theme-options';
import {Observable} from 'rxjs';
import { ConfigService } from '../../../ThemeOptions/store/config.service';
import { ConfigState } from '../../../ThemeOptions/store/config.state';
import {ActivatedRoute} from '@angular/router';
import { Router } from '@angular/router';
import { ADMIN_MENU_GROUPS } from '../../../Administracion/admin-entity.config';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  standalone: false,
  styles: [`
    /* Override the existing styles with important to ensure animation works */
    .vsm-dropdown {
      max-height: 0 !important;
      overflow: hidden !important;
      opacity: 0 !important;
      transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out !important;
      position: relative !important;
    }
    
    .vsm-dropdown-show {
      max-height: 1000px !important;
      opacity: 1 !important;
    }

    .app-sidebar {
      height: 100vh !important;
      overflow: hidden !important;
    }

    .app-sidebar-content {
      height: calc(100vh - 60px) !important;
      overflow: hidden !important;
    }

    .app-sidebar-scroll,
    .sidebar-scrollbar {
      height: 100% !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
    }

    .sidebar-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: rgba(60, 84, 120, 0.35) transparent;
    }

    .sidebar-scrollbar::-webkit-scrollbar {
      width: 7px;
    }

    .sidebar-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(60, 84, 120, 0.35);
      border-radius: 8px;
    }

    .sidebar-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }

    .steam-logo {
      color: #c1121f !important;
      font-weight: 800 !important;
      letter-spacing: 0 !important;
    }
    
    /* Arrow rotation - override existing transform */
    .vsm-item.has-sub .vsm-arrow {
      transition: transform 0.3s ease !important;
      transform: rotate(270deg) !important;  /* Point right */
    }
    
    .vsm-item.has-sub.vsm-open .vsm-arrow {
      transform: rotate(360deg) !important;  /* Point down */
    }
  `]
})
export class SidebarComponent implements OnInit {
  public extraParameter: string | undefined;
  public openMenus: string[] = [];
  public adminMenuGroups = ADMIN_MENU_GROUPS;
  
  // Supported menu types: dashboardsMenu, adminMenu, pagesMenu, elementsMenu, componentsMenu,
  // tablesMenu, formsMenu, chartsMenu, widgetsMenu

  public config$: Observable<ConfigState>;

  constructor(
    public globals: ThemeOptions,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private configService: ConfigService
  ) {
    this.config$ = this.configService.config$;

    afterNextRender(() => {
      this.innerWidth = window.innerWidth;
      if (this.innerWidth < 1200) {
        this.globals.toggleSidebar.set(true);
      }
    });
  }

  private newInnerWidth = 0;
  private innerWidth = 0;
  activeId = 'dashboardsMenu';

  toggleSidebar() {
    this.globals.toggleSidebar.set(!this.globals.toggleSidebar());
    if (this.globals.toggleSidebar()) {
      this.globals.sidebarHover.set(false);
    }
  }

  onSidebarMouseEnter() {
    if (this.globals.toggleSidebar()) {
      this.globals.sidebarHover.set(true);
    }
  }

  onSidebarMouseLeave() {
    if (this.globals.toggleSidebar()) {
      this.globals.sidebarHover.set(false);
    }
  }

  ngOnInit() {
    // Get the extraParameter from the route to determine which menu should be open
    this.extraParameter = this.activatedRoute.snapshot.firstChild?.data['extraParameter'];

    // Initialize open menus based on current route
    const currentAdminMenu = this.adminMenuIdForUrl(this.router.url);
    if (currentAdminMenu) {
      this.openMenus = [currentAdminMenu];
    } else if (this.extraParameter) {
      this.openMenus = [this.extraParameter];
    }
  }

  toggleSubmenu(menuId: string) {
    // Toggle submenu: close if open, open if closed (and close all others)
    const index = this.openMenus.indexOf(menuId);
    if (index > -1) {
      this.openMenus.splice(index, 1);
    } else {
      this.openMenus = [menuId]; // Close others and open this one
    }
  }

  onNavigate() {
    if (window.innerWidth < 1200) {
      this.globals.toggleSidebarMobile.set(true);
      this.globals.sidebarHover.set(false);
    }
  }

  isAdminGroupActive(group: { items: { path: string }[] }): boolean {
    return group.items.some(item => this.router.url.startsWith(item.path));
  }

  private adminMenuIdForUrl(url: string): string | undefined {
    return this.adminMenuGroups.find(group =>
      group.items.some(item => url.startsWith(item.path))
    )?.id;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.newInnerWidth = (event.target as Window).innerWidth;
    this.globals.toggleSidebar.set(this.newInnerWidth < 1200);
  }
}
