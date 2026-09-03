import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Boxes, Check, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { useNamespaceStore } from '@/stores/namespace-store';
import { getLangfuseProjectMap } from '@/lib/appEnv';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// 路由 -> 页面标题映射
const TITLE_MAP: Record<string, string> = {
  '/agentManagement': 'Agent 管理',
  '/skill': 'Skill 管理',
  '/skillDetail': 'Skill 详情',
  '/datasetManagement': '数据集管理',
  '/datasetDetail': '数据集详情',
  '/datasetExperimentDetail': '实验详情',
};

function resolveTitle(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  // 匹配子路径
  const matched = Object.keys(TITLE_MAP)
    .filter((p) => p !== '/' && pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return matched ? TITLE_MAP[matched] : '';
}

export function Header() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { currentNamespace, setCurrentNamespace } = useNamespaceStore();
  const location = useLocation();

  const sidebarToggleLabel = sidebarCollapsed ? '展开侧栏' : '收起侧栏';
  const pageTitle = resolveTitle(location.pathname);

  // 空间列表来自 Langfuse 项目密钥映射（LANGFUSE_PROJECT_MAP）的 keys
  const workspaces = useMemo(
    () => Object.keys(getLangfuseProjectMap()),
    [],
  );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md lg:px-6">
      {/* Left - Sidebar toggle and page title */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={toggleSidebar}
              aria-label={sidebarToggleLabel}
            >
              {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{sidebarToggleLabel}</TooltipContent>
        </Tooltip>

        {pageTitle && (
          <div className="hidden items-center gap-2 sm:flex min-w-0">
            <span className="text-slate-300 select-none">/</span>
            <span className="truncate text-sm font-semibold text-slate-800">
              {pageTitle}
            </span>
          </div>
        )}
      </div>

      {/* Right - Workspace selector */}
      <div className="flex items-center gap-2 shrink-0">
        {workspaces.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                aria-label="选择空间"
              >
                <Boxes size={14} className="shrink-0 text-blue-600" />
                <span className="text-xs max-w-[160px] truncate">
                  {currentNamespace || '选择空间'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
              <DropdownMenuLabel className="text-xs font-medium text-slate-500">
                选择空间
              </DropdownMenuLabel>
              {workspaces.map((ws) => (
                <DropdownMenuItem key={ws} onSelect={() => setCurrentNamespace(ws)}>
                  <Check
                    className={cn(
                      'h-3.5 w-3.5',
                      currentNamespace === ws ? 'opacity-100 text-blue-600' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{ws}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
