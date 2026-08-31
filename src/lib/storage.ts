const THEME_KEY = 'nacos_theme';
const SIDEBAR_KEY = 'nacos_sidebar_collapsed';
const WORKSPACE_KEY = 'nacos_current_workspace';

// Theme
export function getTheme(): 'light' | 'dark' {
  const theme = localStorage.getItem(THEME_KEY);
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }
  return 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem(THEME_KEY, theme);
}

// Sidebar
export function getSidebarCollapsed(): boolean {
  const collapsed = localStorage.getItem(SIDEBAR_KEY);
  return collapsed === 'true';
}

export function setSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_KEY, String(collapsed));
}

// Current workspace
export function getCurrentWorkspace(): string {
  return localStorage.getItem(WORKSPACE_KEY) ?? '';
}

export function setCurrentWorkspace(key: string): void {
  localStorage.setItem(WORKSPACE_KEY, key);
}
