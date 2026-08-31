import { useState } from 'react';
import {
  Send,
  Rocket,
  Globe,
  PowerOff,
  Trash2,
  Clock,
  Download,
  Plus,
  GitBranch,
  Tag,
  ShieldOff,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import type { SkillVersionSummary } from '@/types/skill';
import { parsePipelineInfo } from '@/types/skill';
import { getValidActionsWithContext, sortVersionsDescending } from './version-utils';
import { PipelineStatusDisplay } from './PipelineStatusDisplay';
import { LabelBindDialog } from '@/components/ai/LabelBindDialog';

interface SkillVersionTimelineProps {
  versions: SkillVersionSummary[];
  currentVersion: string;
  hasEditingVersion: boolean;
  hasReviewingVersion: boolean;
  onSelectVersion: (version: string) => void;
  onCreateDraft: (basedOnVersion?: string) => void;
  onDeleteDraft: (version: string) => void;
  onSubmit: (version: string) => void;
  onPublish: (version: string) => void;
  onOnline: (version: string) => void;
  onOffline: (version: string) => void;
  onDownload?: (version: string) => void;
  showCreateDraftButton?: boolean;
  allLabels?: Record<string, string>;
  onSaveLabels?: (labels: Record<string, string>) => Promise<void>;
  skillEnabled?: boolean;
  /** 跨空间只读：仅保留查看与下载 */
  readOnly?: boolean;
}

const VERSION_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  reviewing: '审核中',
  reviewed: '待发布',
  pendingPublish: '待发布',
  rejected: '审核未通过',
  online: '已上线',
  offline: '已下线',
};

const STATUS_STYLES: Record<string, string> = {
  draft:
    'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  reviewing:
    'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  pendingPublish:
    'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
  rejected:
    'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  online:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  offline:
    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const DOT_STYLES: Record<string, string> = {
  draft: 'bg-amber-400',
  reviewing: 'bg-blue-400',
  pendingPublish: 'bg-teal-400',
  rejected: 'bg-red-400',
  online: 'bg-emerald-400',
  offline: 'bg-gray-400',
};

export function SkillVersionTimeline({
  versions,
  currentVersion,
  hasEditingVersion,
  hasReviewingVersion,
  onSelectVersion,
  onCreateDraft,
  onDeleteDraft,
  onSubmit,
  onPublish,
  onOnline,
  onOffline,
  onDownload,
  showCreateDraftButton = true,
  allLabels,
  onSaveLabels,
  skillEnabled = true,
  readOnly = false,
}: SkillVersionTimelineProps) {
  const [labelEditVersion, setLabelEditVersion] = useState<string | null>(null);

  const sorted = sortVersionsDescending(versions);

  // Extract labels for a specific version (filter out 'latest')
  const getLabelsForVersion = (version: string): Record<string, string> => {
    if (!allLabels) return {};
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(allLabels)) {
      if (val === version && key !== 'latest') {
        result[key] = val;
      }
    }
    return result;
  };

  const actionHandlers: Record<string, (version: string) => void> = {
    submit: onSubmit,
    publish: onPublish,
    online: onOnline,
    offline: onOffline,
    createDraftFrom: (version: string) => onCreateDraft(version),
  };

  const actionMeta: Record<string, { icon: React.ReactNode; label: string; variant?: 'default' | 'outline' | 'destructive' | 'ghost' }> = {
    submit: { icon: <Send className="h-3 w-3" />, label: '提交发布' },
    publish: { icon: <Rocket className="h-3 w-3" />, label: '发布' },
    // online: { icon: <Globe className="h-3 w-3" />, label: '版本上线' },
    // offline: { icon: <PowerOff className="h-3 w-3" />, label: '版本下线', variant: 'outline' },
    deleteDraft: { icon: <Trash2 className="h-3 w-3" />, label: '删除草稿', variant: 'destructive' },
    createDraftFrom: { icon: <GitBranch className="h-3 w-3" />, label: '基于此版本创建草稿' },
  };

  return (
    <div className="space-y-1">
      {/* Create draft button */}
      {!readOnly && showCreateDraftButton && ((() => {
        const hasDraft = hasEditingVersion || hasReviewingVersion;
        const btn = (
          <Button
            variant="outline"
            size="sm"
            className="mb-3 w-full"
            disabled={hasDraft}
            onClick={() => onCreateDraft()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            创建草稿
          </Button>
        );
        return hasDraft ? (
          <Tooltip>
            {/* <TooltipTrigger asChild>
              <span className="w-full">{btn}</span>
            </TooltipTrigger> */}
            <TooltipContent className="bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0" />
                已存在草稿/未发布版本
              </span>
            </TooltipContent>
          </Tooltip>
        ) : null;
      })())}

      {/* Skill disabled banner */}
      {!readOnly && !skillEnabled && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md bg-amber-50/60 border border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-800/40">
          <ShieldOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-[11px] text-amber-700 dark:text-amber-300">Skill 已禁用，版本状态变更不会生效</span>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {sorted.map((v, idx) => {
          const isActive = v.version === currentVersion;
          const pipelineInfo = parsePipelineInfo(v.publishPipelineInfo);
          const actionItems = getValidActionsWithContext(
            v.status,
            hasEditingVersion || hasReviewingVersion,
            pipelineInfo?.status,
            pipelineInfo?.historical,
          );

          const isPendingPublish = (v.status === 'reviewed' && pipelineInfo?.status !== 'REJECTED') || (v.status === 'reviewing' && pipelineInfo?.status === 'APPROVED');
          const isRejected = v.status === 'reviewed' && pipelineInfo?.status === 'REJECTED';
          const displayStatus = isRejected ? 'rejected' : isPendingPublish ? 'pendingPublish' : v.status;

          return (
            <div key={v.version} className="relative flex gap-3 pb-4">
              {/* Vertical line */}
              {idx < sorted.length - 1 && (
                <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />
              )}

              {/* Dot */}
              <div
                className={cn(
                  'relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-background',
                  DOT_STYLES[displayStatus] ?? 'bg-gray-400',
                  isActive && 'ring-2 ring-primary ring-offset-1',
                )}
              />

              {/* Content */}
              <div
                className={cn(
                  'flex-1 rounded-lg border p-3 cursor-pointer transition-colors',
                  isActive
                    ? 'border-primary/40 bg-primary/5'
                    : 'hover:bg-muted/40',
                )}
                onClick={() => onSelectVersion(v.version)}
              >
                {/* Header row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{v.version}</span>
                  <Badge
                    className={cn(
                      'text-[10px] px-1.5 py-0 h-4 font-medium border-0',
                      STATUS_STYLES[displayStatus],
                    )}
                  >
                    {VERSION_STATUS_LABELS[displayStatus] ?? displayStatus}
                  </Badge>
                  {/* Pipeline status badge */}
                  {pipelineInfo && (
                    <PipelineStatusDisplay pipelineInfo={pipelineInfo} compact />
                  )}
                  {v.downloadCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Download className="h-2.5 w-2.5" />
                      {v.downloadCount}
                    </span>
                  )}
                </div>

                {/* Labels for this version */}
                {allLabels && (() => {
                  const vLabels = getLabelsForVersion(v.version);
                  const labelKeys = Object.keys(vLabels);
                  return labelKeys.length > 0 ? (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                      {labelKeys.map((key) => (
                        <Badge
                          key={key}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 font-mono"
                        >
                          {key}
                        </Badge>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Meta */}
                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                  {v.author && <span>{v.author}</span>}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {dayjs(v.updateTime).format('YYYY-MM-DD HH:mm')}
                  </span>
                </div>

                {v.commitMsg && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {v.commitMsg}
                  </p>
                )}

                {/* Action buttons */}
                {((!readOnly && actionItems.length > 0) || onDownload || (!readOnly && onSaveLabels)) && (
                  <div
                    className="flex items-center gap-1.5 mt-2 flex-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!readOnly &&
                      actionItems.map((item) => {
                        const meta = actionMeta[item.action];
                        if (!meta) return null;

                        const handler =
                          item.action === 'deleteDraft'
                            ? onDeleteDraft
                            : actionHandlers[item.action];

                        const button = (
                          <Button
                            key={item.action}
                            variant={meta.variant ?? 'ghost'}
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            disabled={item.disabled}
                            onClick={() => handler?.(v.version)}
                          >
                            {meta.icon}
                            {meta.label}
                          </Button>
                        );

                        if (item.disabled && item.disabledReason) {
                          return (
                            <Tooltip key={item.action}>
                              <TooltipTrigger asChild>
                                <span>{button}</span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                                <span className="flex items-center gap-1.5">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  {item.disabledReason}
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }

                        return button;
                      })}
                    {onDownload && v.status !== 'draft' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => onDownload(v.version)}
                      >
                        <Download className="h-3 w-3" />
                        下载
                      </Button>
                    )}
                    {/* {onSaveLabels && v.status !== 'draft' && v.status !== 'reviewing' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setLabelEditVersion(v.version)}
                      >
                        <Tag className="h-3 w-3" />
                        编辑版本标签
                      </Button>
                    )} */}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无版本
          </p>
        )}
      </div>

      {/* {onSaveLabels && labelEditVersion && (
        <LabelBindDialog
          open={!!labelEditVersion}
          onOpenChange={(open) => !open && setLabelEditVersion(null)}
          version={labelEditVersion}
          allLabels={allLabels ?? {}}
          onSave={onSaveLabels}
        />
      )} */}
    </div>
  );
}
