import { useState, useCallback } from 'react';
import { Copy, Check, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';

interface CliCommand {
  /** Short label shown above the command, e.g. "By version" */
  label: string;
  command: string;
}

interface CliCommandCardProps {
  commands: CliCommand[];
  className?: string;
  /** When provided, renders a download ZIP button section */
  onDownload?: () => void;
  /** File name hint shown on the download button, e.g. "skill-name-1.0.0.zip" */
  downloadFileName?: string;
  /** Whether download is available (e.g. non-draft version selected) */
  downloadDisabled?: boolean;
}

export function CliCommandCard({ commands, className, onDownload, downloadFileName, downloadDisabled }: CliCommandCardProps) {
  const downloadLabel = downloadFileName || '下载 .zip 文件';

  if (commands.length === 0 && !onDownload) return null;

  return (
    <Card className={cn('overflow-hidden py-0 gap-0 shadow-sm border border-border/80', className)}>
      <div className="px-4 py-3 border-b bg-muted/30">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          安装
        </h2>
      </div>
      <CardContent className="p-3.5 space-y-3">
        {onDownload ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">手动下载</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9 min-w-0 overflow-hidden text-xs gap-1.5 justify-start px-3 border-border bg-background hover:bg-muted/50"
              disabled={downloadDisabled}
              onClick={onDownload}
            >
              <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate" title={downloadLabel}>
                {downloadLabel}
              </span>
            </Button>
          </div>
        ) : null}

        {commands.length > 0 ? (
          <>
            {onDownload ? <div className="border-t" /> : null}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                CLI 安装
                <a
                  href="https://github.com/nacos-group/nacos-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  CLI 使用文档
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              {commands.map((cmd, idx) => (
                <CommandBlock key={idx} command={cmd.command} />
              ))}
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-3 py-2.5 space-y-2">
                <p className="text-left text-[11px] font-medium text-amber-800 dark:text-amber-300">
                  执行失败时请逐一检查
                </p>
                <div>
                  <p className="text-left text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                    npx 是否可用：
                  </p>
                  <PrereqCommand command="npx -v" className="mt-1" />
                </div>
                <div>
                  <p className="text-left text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                    镜像源是否为内网源：
                  </p>
                  <PrereqCommand command="npm config get registry" className="mt-1" />
                </div>
                <p className="text-left text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                  若未通过，安装 Node.js 并执行：
                </p>
                <div className="space-y-1.5">
                  <PrereqCommand command="npm install -g npx" />
                  <PrereqCommand command="npm config set registry http://192.168.154.101:8081/repository/npm_swhysc/" />
                </div>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(command);
    if (ok) {
      setCopied(true);
      toast.success('命令已复制');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [command]);

  return (
    <div>
      <div className="group relative rounded-md bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 overflow-hidden">
        <pre className="px-3 py-2.5 pr-10 text-[11px] leading-relaxed text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
          <span className="text-emerald-400 select-none">$ </span>
          {command}
        </pre>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1.5 right-1.5 h-6 w-6 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

function PrereqCommand({
  command,
  className,
}: {
  command: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(command);
    if (ok) {
      setCopied(true);
      toast.success('命令已复制');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [command]);

  return (
    <div
      className={cn(
        'group rounded-md border border-amber-200 bg-background dark:border-amber-500/30 px-2.5 py-1.5',
        className,
      )}
    >
      <div className="flex items-start gap-1.5">
        <code className="flex-1 min-w-0 break-all whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-foreground select-all">
          {command}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}
