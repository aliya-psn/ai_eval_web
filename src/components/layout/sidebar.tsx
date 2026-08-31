import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAssetUrl } from '@/utils/asset-url';
import {
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
      label: 'AI 注册中心',
      icon: <Bot size={18} />,
      badge: 'new',
      defaultOpen: true,
      children: [
        { key: 'skillRegistry', label: 'Skill 管理', path: '/skill', badge: 'new' },
        { key: 'datasetRegistry', label: '数据集管理', path: '/datasetManagement', badge: 'new' },
        { key: 'evaluatorRegistry', label: '评测器管理', path: '/evaluatorManagement', badge: 'new' },
        { key: 'agentRegistry', label: 'Agent 管理', path: '/agentManagement', badge: 'new' },
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
    };
    return map[key] || <Sparkles size={16} />;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar-background/80 backdrop-blur-xl transition-all duration-300 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-14 items-center justify-center border-b border-sidebar-border">
        {!sidebarCollapsed ? (
          <img
            src={getAssetUrl('img/nacos-logo-dark.svg')}
            alt="Nacos"
            className="h-6 w-auto max-w-[140px] object-contain"
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <img
                src={getAssetUrl('img/nacos-logo-dark.svg')}
                alt="Nacos"
                className="h-7 w-7 object-contain cursor-default"
              />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="rounded-lg border border-border/50 bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs font-medium">
              NACOS {version && `v${version}`}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <ScrollArea className="flex-1 py-2">
        <div className="px-2 space-y-1">
          {!sidebarCollapsed && coreItems.length > 0 && (
            <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {'AI 注册中心'}
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
            <div className="px-3 py-4 text-xs text-muted-foreground">
              {'暂无数据'}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border px-2 py-3">
        {!sidebarCollapsed && (
          <div className="min-h-5 px-2 text-center text-xs leading-5 text-muted-foreground">
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
          ? 'bg-sidebar-accent text-sidebar-primary'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
      )}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gradient-to-b from-blue-500 to-blue-600" />
      )}
      <span className="shrink-0">{item.icon}</span>
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
        <TooltipContent side="right" sideOffset={8} className="rounded-lg border border-border/50 bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs font-medium">
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
  const expanded = open || isGroupActive;

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
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
            )}
          >
            {isGroupActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gradient-to-b from-blue-500 to-blue-600" />
            )}
            {item.icon}
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
          className="w-48 p-1.5 rounded-xl shadow-lg border border-border/60 bg-popover/95 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="text-muted-foreground shrink-0">{item.icon}</span>
            <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
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
                    ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
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
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-200">
        <span className="shrink-0">{item.icon}</span>
        <span className="truncate flex-1 text-left">{item.label}</span>
        {item.badge && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 mr-1">
            {item.badge}
          </Badge>
        )}
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3 mt-0.5">
        {item.children?.map((child) => (
          <button
            key={child.key}
            onClick={() => onNavigate(child.path)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all duration-200',
              isActive(child.path)
                ? 'text-sidebar-primary font-medium bg-sidebar-accent'
                : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
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
      </CollapsibleContent>
    </Collapsible>
  );
}
