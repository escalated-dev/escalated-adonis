/*
|--------------------------------------------------------------------------
| PluginUIService
|--------------------------------------------------------------------------
|
| Service for plugins to register custom UI elements — menu items,
| dashboard widgets, and page component slots. These registrations
| are accumulated at boot time and can be queried by controllers to
| inject plugin-provided UI into Inertia responses.
|
*/

export interface MenuItem {
  label: string
  route?: string | null
  url?: string | null
  icon?: string | null
  permission?: string | null
  position: number
  parent?: string | null
  badge?: string | number | null
  activeRoutes: string[]
  submenu: SubmenuItem[]
}

export interface SubmenuItem {
  label: string
  route?: string | null
  url?: string | null
  icon?: string | null
  permission?: string | null
  activeRoutes: string[]
}

export interface DashboardWidget {
  id: string
  title: string
  component: string | null
  data: Record<string, any>
  position: number
  width: 'full' | 'half' | 'third' | 'quarter'
  permission?: string | null
}

export interface PageComponent {
  component: string | null
  data: Record<string, any>
  position: number
  permission?: string | null
  plugin?: string
}

const MENU_ITEM_DEFAULTS: MenuItem = {
  label: 'Custom Item',
  route: null,
  url: null,
  icon: null,
  permission: null,
  position: 100,
  parent: null,
  badge: null,
  activeRoutes: [],
  submenu: [],
}

const WIDGET_DEFAULTS: Omit<DashboardWidget, 'id'> = {
  title: 'Custom Widget',
  component: null,
  data: {},
  position: 100,
  width: 'full',
  permission: null,
}

const PAGE_COMPONENT_DEFAULTS: PageComponent = {
  component: null,
  data: {},
  position: 100,
  permission: null,
}

export default class PluginUIService {
  protected menuItems: MenuItem[] = []
  protected dashboardWidgets: DashboardWidget[] = []
  protected pageComponents: Map<string, Map<string, PageComponent[]>> = new Map()

  // ---- Menu Items ----

  /**
   * Register a custom menu item.
   */
  addMenuItem(item: Partial<MenuItem>): void {
    this.menuItems.push({ ...MENU_ITEM_DEFAULTS, ...item } as MenuItem)
  }

  /**
   * Register multiple menu items at once.
   */
  addMenuItems(items: Partial<MenuItem>[]): void {
    for (const item of items) {
      this.addMenuItem(item)
    }
  }

  /**
   * Add a submenu item to an existing menu item identified by its label.
   */
  addSubmenuItem(parentLabel: string, submenuItem: Partial<SubmenuItem>): void {
    const defaults: SubmenuItem = {
      label: 'Submenu Item',
      route: null,
      url: null,
      icon: null,
      permission: null,
      activeRoutes: [],
    }

    const fullItem = { ...defaults, ...submenuItem } as SubmenuItem

    for (const menuItem of this.menuItems) {
      if (menuItem.label === parentLabel) {
        if (!menuItem.submenu) {
          menuItem.submenu = []
        }
        menuItem.submenu.push(fullItem)
        break
      }
    }
  }

  /**
   * Get all registered menu items, sorted by position.
   */
  getMenuItems(): MenuItem[] {
    return [...this.menuItems].sort((a, b) => a.position - b.position)
  }

  // ---- Dashboard Widgets ----

  /**
   * Register a dashboard widget.
   */
  addDashboardWidget(widget: Partial<DashboardWidget>): void {
    const id = widget.id ?? `widget_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.dashboardWidgets.push({
      ...WIDGET_DEFAULTS,
      ...widget,
      id,
    } as DashboardWidget)
  }

  /**
   * Get all registered dashboard widgets, sorted by position.
   */
  getDashboardWidgets(): DashboardWidget[] {
    return [...this.dashboardWidgets].sort((a, b) => a.position - b.position)
  }

  // ---- Page Component Slots ----

  /**
   * Register a component to be injected into an existing page at a named slot.
   *
   * @param page - Page identifier (e.g. 'ticket.show', 'dashboard', 'ticket.index')
   * @param slot - Slot name (e.g. 'sidebar', 'header', 'footer', 'tabs')
   * @param component - Component configuration
   */
  addPageComponent(page: string, slot: string, component: Partial<PageComponent>): void {
    if (!this.pageComponents.has(page)) {
      this.pageComponents.set(page, new Map())
    }

    const pageSlots = this.pageComponents.get(page)!
    if (!pageSlots.has(slot)) {
      pageSlots.set(slot, [])
    }

    pageSlots.get(slot)!.push({ ...PAGE_COMPONENT_DEFAULTS, ...component } as PageComponent)
  }

  /**
   * Get components registered for a specific page and slot, sorted by position.
   */
  getPageComponents(page: string, slot: string): PageComponent[] {
    const pageSlots = this.pageComponents.get(page)
    if (!pageSlots) {
      return []
    }

    const components = pageSlots.get(slot)
    if (!components) {
      return []
    }

    return [...components].sort((a, b) => a.position - b.position)
  }

  /**
   * Get all components for a specific page, organized by slot.
   */
  getAllPageComponents(page: string): Record<string, PageComponent[]> {
    const pageSlots = this.pageComponents.get(page)
    if (!pageSlots) {
      return {}
    }

    const result: Record<string, PageComponent[]> = {}
    for (const [slot, components] of pageSlots) {
      result[slot] = [...components].sort((a, b) => a.position - b.position)
    }
    return result
  }

  /**
   * Clear all registered UI elements. Useful for testing.
   */
  clear(): void {
    this.menuItems = []
    this.dashboardWidgets = []
    this.pageComponents.clear()
  }
}
