import type { ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { appAntdTheme } from '@/theme/appAntdTheme';
import '@/theme/antd.css';

interface AppAntdProviderProps {
  children: ReactNode;
}

function getPopupContainer(node?: HTMLElement): HTMLElement {
  if (node) {
    const scoped = node.closest('.app-antd');
    if (scoped instanceof HTMLElement) return scoped;
  }
  const root =
    document.querySelector('.app-antd') ||
    document.querySelector('#ai_eval_web');
  return (root as HTMLElement) || document.body;
}

/**
 * 应用级 antd Provider：主题 + 通用样式。
 * 挂在 Layout 最外层，供页面共用。
 */
export function AppAntdProvider({ children }: AppAntdProviderProps) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={appAntdTheme}
      getPopupContainer={getPopupContainer}
    >
      <div className="app-antd">{children}</div>
    </ConfigProvider>
  );
}
