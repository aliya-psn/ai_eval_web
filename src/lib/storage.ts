const THEME_KEY = 'nacos_theme';
const SIDEBAR_KEY = 'nacos_sidebar_collapsed';
const WORKSPACE_KEY = 'nacos_current_workspace';
const LANGFUSE_SESSION_KEY = 'langfuse_session_cookie';

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

// Langfuse session cookie（持久化，避免刷新后重复登录）
export function getStoredLangfuseSession(): string | null {
  return localStorage.getItem(LANGFUSE_SESSION_KEY);
}

export function storeLangfuseSession(session: string): void {
  localStorage.setItem(LANGFUSE_SESSION_KEY, session);
}

export function clearStoredLangfuseSession(): void {
  localStorage.removeItem(LANGFUSE_SESSION_KEY);
}
