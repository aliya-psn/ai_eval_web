import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { useServerStore } from '@/stores/server-store';
import { useNamespaceStore } from '@/stores/namespace-store';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useRef } from 'react';

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  badge?: string;
  children?: { key: string; label: string; path: string; badge?: string }[];
  defaultOpen?: boolean;
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed } = useAppStore();
  const { version, startupMode, functionMode, aiEnabled } = useServerStore();
  const { currentNamespace, namespaceShowName } = useNamespaceStore();

  const coreItems: NavItem[] = [];

  if (aiEnabled && functionMode !== 'naming' && functionMode !== 'config' && functionMode !== 'microservice') {
    coreItems.push({
      key: 'ai',
      label: 'AI 资产管理',
      icon: <Bot size={18} />,
      defaultOpen: true,
      children: [
        { key: 'skillRegistry', label: 'Skill 管理', path: '/skill' },
        { key: 'agentRegistry', label: 'Agent 管理', path: '/agentManagement' },
        { key: 'datasetRegistry', label: '数据集管理', path: '/datasetManagement' },
        // { key: 'evaluatorRegistry', label: '评估器管理', path: '/evaluatorManagement' },
      ],
    });
    coreItems.push({
      key: 'analysis',
      label: '测评结果分析',
      icon: <BarChart3 size={18} />,
      defaultOpen: true,
      children: [
        { key: 'traceRegistry', label: 'Trace 追踪', path: '/trace' },
        // { key: 'reportRegistry', label: '测试报告', path: '/report' },
      ],
    });
  }

  const navTo = useCallback(
    (url: string) => {
      const params = new URLSearchParams();
      if (currentNamespace !== undefined) params.set('namespace', currentNamespace);
      if (namespaceShowName) params.set('namespaceShowName', namespaceShowName);
      const qs = params.toString();
      navigate(qs ? `${url}?${qs}` : url);
    },
    [navigate, currentNamespace, namespaceShowName]
  );

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== '/' && location.pathname.startsWith(`${path}/`));
  const isGroupActive = (children?: { path: string }[]) =>
    children?.some((c) => isActive(c.path)) ?? false;

  const iconForChild = (key: string) => {
    const map: Record<string, React.ReactNode> = {
      agentRegistry: <Bot size={16} />,
      skillRegistry: <Wrench size={16} />,
      datasetRegistry: <Database size={16} />,
      evaluatorRegistry: <ClipboardCheck size={16} />,
      reportRegistry: <BarChart3 size={16} />,
      traceRegistry: <BarChart3 size={16} />,
    };
    return map[key] || <Sparkles size={16} />;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r border-slate-200/80 bg-white/80 backdrop-blur-xl transition-all duration-300 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className="flex h-14 items-center justify-center border-b border-slate-100">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2.5 px-2 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-500/25">
              AI
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-bold tracking-wide text-slate-900">
                评测平台
              </div>
              <div className="truncate text-[10px] font-medium text-slate-400">
                AI Evaluation
              </div>
            </div>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex h-8 w-8 cursor-default items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-500/25">
                AI
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="rounded-lg border border-slate-200 bg-white text-slate-800 shadow-md px-3 py-2 text-xs font-medium">
              评测平台 {version && `v${version}`}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <ScrollArea className="flex-1 py-3">
        <div className="px-2.5 space-y-1">
          {!sidebarCollapsed && coreItems.length > 0 && (
            <div className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {'核心功能'}
            </div>
          )}

          {coreItems.map((item) =>
            item.children ? (
              <NavGroup
                key={item.key}
                item={item}
                collapsed={sidebarCollapsed}
                isGroupActive={isGroupActive(item.children)}
                isActive={isActive}
                onNavigate={navTo}
                iconForChild={iconForChild}
              />
            ) : (
              <NavLink
                key={item.key}
                item={item}
                collapsed={sidebarCollapsed}
                active={isActive(item.path!)}
                onClick={() => navTo(item.path!)}
              />
            )
          )}

          {coreItems.length === 0 && !sidebarCollapsed && (
            <div className="px-3 py-4 text-xs text-slate-400">
              {'暂无数据'}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-slate-100 px-2 py-3">
        {!sidebarCollapsed && (
          <div className="min-h-5 px-2 text-center text-xs leading-5 text-slate-400">
            {version && `v${version}`}
            {startupMode && ` · ${startupMode}`}
          </div>
        )}
      </div>
    </aside>
  );
}

function NavLink({
  item,
  collapsed,
  active,
  onClick,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const btn = (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
      )}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gradient-to-b from-blue-500 to-blue-600" />
      )}
      <span className={cn('shrink-0 transition-colors', active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600')}>{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge && (
        <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
          {item.badge}
        </Badge>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="rounded-lg border border-slate-200 bg-white text-slate-800 shadow-md px-3 py-2 text-xs font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return btn;
}

function NavGroup({
  item,
  collapsed,
  isGroupActive,
  isActive,
  onNavigate,
  iconForChild,
}: {
  item: NavItem;
  collapsed: boolean;
  isGroupActive: boolean;
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
  iconForChild: (key: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(isGroupActive || !!item.defaultOpen);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = open;

  useEffect(() => {
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  const handleFlyoutEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFlyoutOpen(true);
  };

  const handleFlyoutLeave = () => {
    closeTimer.current = setTimeout(() => setFlyoutOpen(false), 120);
  };

  if (collapsed) {
    return (
      <Popover open={flyoutOpen}>
        <PopoverTrigger asChild>
          <button
            onMouseEnter={handleFlyoutEnter}
            onMouseLeave={handleFlyoutLeave}
            className={cn(
              'group relative flex w-full items-center justify-center rounded-lg px-3 py-2 transition-all duration-200',
              isGroupActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100/80'
            )}
          >
            {isGroupActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gradient-to-b from-blue-500 to-blue-600" />
            )}
            <span className={cn('transition-colors', isGroupActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600')}>{item.icon}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          onMouseEnter={handleFlyoutEnter}
          onMouseLeave={handleFlyoutLeave}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={() => setFlyoutOpen(false)}
          className="w-48 p-1.5 rounded-xl shadow-lg border border-slate-200 bg-white/95 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="text-slate-400 shrink-0">{item.icon}</span>
            <span className="text-xs font-semibold text-slate-800 truncate">{item.label}</span>
            {item.badge && (
              <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
                {item.badge}
              </Badge>
            )}
          </div>
          <Separator className="my-1" />
          <div className="space-y-0.5">
            {item.children?.map((child) => (
              <button
                key={child.key}
                onClick={() => { onNavigate(child.path); setFlyoutOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                  isActive(child.path)
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-800'
                )}
              >
                <span className="shrink-0 opacity-70">{iconForChild(child.key)}</span>
                <span className="truncate">{child.label}</span>
                {child.badge && (
                  <Badge className={cn(
                    'text-[9px] px-1 py-0 h-3.5 ml-auto font-medium text-white border-0',
                    child.badge === 'Beta' ? 'bg-amber-500 hover:bg-amber-500' : 'bg-destructive hover:bg-destructive',
                  )}>
                    {child.badge}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Collapsible open={expanded} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 transition-all duration-200">
        <span className="shrink-0 text-slate-400">{item.icon}</span>
        <span className="truncate flex-1 text-left">{item.label}</span>
        {item.badge && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 mr-1">
            {item.badge}
          </Badge>
        )}
        {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 space-y-0.5 border-l border-slate-200 pl-3 mt-0.5">
        {item.children?.map((child) => (
          <button
            key={child.key}
            onClick={() => onNavigate(child.path)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all duration-200',
              isActive(child.path)
                ? 'text-blue-700 font-medium bg-blue-50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
            )}
          >
            <span className={cn('shrink-0 opacity-70', isActive(child.path) ? 'text-blue-600' : '')}>{iconForChild(child.key)}</span>
            <span className="truncate">{child.label}</span>
            {child.badge && (
              <Badge className={cn(
                'text-[9px] px-1 py-0 h-3.5 ml-auto font-medium text-white border-0',
                child.badge === 'Beta' ? 'bg-amber-500 hover:bg-amber-500' : 'bg-destructive hover:bg-destructive',
              )}>
                {child.badge}
              </Badge>
            )}
          </button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
