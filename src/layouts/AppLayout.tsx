import { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AppAntdProvider } from '@/components/AppAntdProvider';
import { useAppStore } from '@/stores/app-store';
import { useNamespaceStore } from '@/stores/namespace-store';
import { loadLangfuseProjectName } from '@/api/langfuse';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const { sidebarCollapsed } = useAppStore();
  const { currentNamespace } = useNamespaceStore();
  const location = useLocation();

  // 应用初始化 / 切换空间后预加载 Langfuse 项目名，业务侧直接 getLangfuseProjectName()
  useEffect(() => {
    if (!currentNamespace) return;
    void loadLangfuseProjectName().catch(() => {
      // 初始化失败不阻断页面；提交实验时再补拉或报错
    });
  }, [currentNamespace]);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    html.removeAttribute('data-scroll-locked');
    body.removeAttribute('data-scroll-locked');
    for (const el of [html, body]) {
      el.style.removeProperty('overflow');
      el.style.removeProperty('padding-right');
      el.style.removeProperty('margin-right');
    }
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <TooltipProvider delayDuration={200}>
      <AppAntdProvider>
        <div className={cn('bg-background', 'min-h-screen')}>
          <Sidebar />
          <div
            className={cn(
              'transition-all duration-300',
              sidebarCollapsed ? 'ml-16' : 'ml-64',
            )}
          >
            <Header />
            <main className={cn('p-6')}>
              <Outlet />
            </main>
          </div>
        </div>
      </AppAntdProvider>
    </TooltipProvider>
  );
}
