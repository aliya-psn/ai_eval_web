import { useMemo } from 'react';
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

export function Header() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { currentNamespace, setCurrentNamespace } = useNamespaceStore();

  const sidebarToggleLabel = sidebarCollapsed ? '展开侧栏' : '收起侧栏';

  // 空间列表来自 Langfuse 项目密钥映射（LANGFUSE_PROJECT_MAP）的 keys
  const workspaces = useMemo(
    () => Object.keys(getLangfuseProjectMap()),
    [],
  );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4">
      {/* Left - Sidebar toggle and workspace selector */}
      <div className="flex items-center gap-2 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={toggleSidebar}
              aria-label={sidebarToggleLabel}
            >
              {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{sidebarToggleLabel}</TooltipContent>
        </Tooltip>

        {/* Workspace selector */}
        {workspaces.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 gap-2 px-2 text-muted-foreground"
                aria-label="选择空间"
              >
                <Boxes size={14} className="shrink-0" />
                <span className="text-xs max-w-[160px] truncate">
                  {currentNamespace || '选择空间'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                选择空间
              </DropdownMenuLabel>
              {workspaces.map((ws) => (
                <DropdownMenuItem key={ws} onSelect={() => setCurrentNamespace(ws)}>
                  <Check
                    className={cn(
                      'h-3.5 w-3.5',
                      currentNamespace === ws ? 'opacity-100' : 'opacity-0',
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
