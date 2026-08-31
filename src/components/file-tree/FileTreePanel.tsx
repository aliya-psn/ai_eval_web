import { useState, useCallback, useRef, useEffect } from 'react';
import {
  File,
  Folder,
  FolderOpen,
  FileJson,
  FilePlus,
  FolderPlus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ===== Types =====

export interface FileTreeNode {
  key: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  resourceType?: string;
}

export interface FileTreePanelProps {
  nodes: FileTreeNode[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  editable: boolean;
  onCreateFile?: (parentKey?: string) => void;
  onCreateFolder?: (parentKey?: string) => void;
  onDeleteNode?: (key: string, nodeType: 'file' | 'folder') => void;
  onRenameFile?: (key: string, newName: string) => void;
  onRenameFolder?: (key: string, newName: string) => void;
}

// ===== Constants =====

const MANIFEST_KEY = 'manifest.json';

// ===== Sub-components =====

function FileIcon({ node }: { node: FileTreeNode }) {
  if (node.key === MANIFEST_KEY) {
    return <FileJson className="h-4 w-4 shrink-0 text-amber-500" />;
  }
  if (node.type === 'folder') {
    return null; // handled by FolderNode
  }
  return <File className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

interface TreeNodeProps {
  node: FileTreeNode;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  editable: boolean;
  onCreateFile?: (parentKey?: string) => void;
  onCreateFolder?: (parentKey?: string) => void;
  onDeleteNode?: (key: string, nodeType: 'file' | 'folder') => void;
  onRenameFile?: (key: string, newName: string) => void;
  onRenameFolder?: (key: string, newName: string) => void;
  depth: number;
}

function TreeActionButton({
  onClick,
  label,
  children,
  destructive = false,
}: {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  label: string;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            destructive && 'hover:bg-destructive/10 hover:text-destructive',
          )}
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function RenameInput({
  initialName,
  onConfirm,
  onCancel,
}: {
  initialName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialName) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') onCancel();
      }}
      className="h-6 px-1 py-0 text-sm"
    />
  );
}

function FileNode({
  node,
  selectedKey,
  onSelect,
  editable,
  onDeleteNode,
  onRenameFile,
  depth,
}: TreeNodeProps) {
  const [renaming, setRenaming] = useState(false);
  const isSelected = selectedKey === node.key;
  const canShowActions = editable && Boolean(onRenameFile || onDeleteNode);

  const handleRename = useCallback(
    (newName: string) => {
      setRenaming(false);
      onRenameFile?.(node.key, newName);
    },
    [node.key, onRenameFile],
  );

  return (
    <div
      className={cn(
        'group/row flex items-center gap-1 overflow-hidden px-2 py-1 cursor-pointer rounded-sm text-sm hover:bg-accent/50',
        isSelected && 'text-foreground',
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => !renaming && onSelect(node.key)}
      title={node.key}
      role="treeitem"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (!renaming && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(node.key);
        }
      }}
    >
      <FileIcon node={node} />
      {renaming ? (
        <RenameInput
          initialName={node.name}
          onConfirm={handleRename}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {canShowActions && (
            <div
              className={cn(
                'ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100',
                isSelected && 'opacity-100',
              )}
            >
              {onRenameFile && (
                <TreeActionButton
                  label={`重命名 ${node.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setRenaming(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </TreeActionButton>
              )}
              {onDeleteNode && (
                <TreeActionButton
                  label={`删除 ${node.name}`}
                  destructive
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteNode(node.key, 'file');
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </TreeActionButton>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FolderNode({
  node,
  selectedKey,
  onSelect,
  editable,
  onCreateFile,
  onCreateFolder,
  onDeleteNode,
  onRenameFile,
  onRenameFolder,
  depth,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const canRename = true;
  const folderLabel = node.name.replace(/\/$/, '');

  const handleRename = useCallback(
    (newName: string) => {
      setRenaming(false);
      onRenameFolder?.(node.key, newName);
    },
    [node.key, onRenameFolder],
  );

  return (
    <div role="group">
      <div
        className="group/row flex items-center gap-1 overflow-hidden px-2 py-1 cursor-pointer rounded-sm text-sm hover:bg-accent/50 font-medium"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => !renaming && setExpanded(!expanded)}
        title={node.key.replace(/\/$/, '')}
        role="treeitem"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        {expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-blue-500" />
        )}
        {renaming ? (
          <RenameInput
            initialName={folderLabel}
            onConfirm={handleRename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate">{folderLabel}</span>
            {editable && (
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                {canRename && (
                  <TreeActionButton
                    label={`重命名 ${folderLabel}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setRenaming(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </TreeActionButton>
                )}
                <TreeActionButton
                  label={`在 ${folderLabel} 中新建文件`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreateFile?.(node.key);
                  }}
                >
                  <FilePlus className="h-3.5 w-3.5" />
                </TreeActionButton>
                <TreeActionButton
                  label={`在 ${folderLabel} 中新建文件夹`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreateFolder?.(node.key);
                  }}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </TreeActionButton>
                <TreeActionButton
                  label={`删除 ${folderLabel}`}
                  destructive
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteNode?.(node.key, 'folder');
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </TreeActionButton>
              </div>
            )}
          </>
        )}
      </div>
      {expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.key}
              node={child}
              selectedKey={selectedKey}
              onSelect={onSelect}
              editable={editable}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onDeleteNode={onDeleteNode}
              onRenameFile={onRenameFile}
              onRenameFolder={onRenameFolder}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNodeItem(props: TreeNodeProps) {
  if (props.node.type === 'folder') {
    return <FolderNode {...props} />;
  }
  return <FileNode {...props} />;
}

// ===== Main Component =====

export function FileTreePanel({
  nodes,
  selectedKey,
  onSelect,
  editable,
  onCreateFile,
  onCreateFolder,
  onDeleteNode,
  onRenameFile,
  onRenameFolder,
}: FileTreePanelProps) {

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          文件
        </span>
        {editable && (
          <div className="flex items-center gap-0.5">
            <TreeActionButton label="新建文件" onClick={() => onCreateFile?.()}>
              <FilePlus className="h-3.5 w-3.5" />
            </TreeActionButton>
            <TreeActionButton label="新建文件夹" onClick={() => onCreateFolder?.()}>
              <FolderPlus className="h-3.5 w-3.5" />
            </TreeActionButton>
          </div>
        )}
      </div>
      <ScrollArea className="flex-1 bg-inherit">
        <div className="min-h-full bg-inherit py-2" role="tree" aria-label="文件树">
          {nodes.map((node) => (
            <TreeNodeItem
              key={node.key}
              node={node}
              selectedKey={selectedKey}
              onSelect={onSelect}
              editable={editable}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onDeleteNode={onDeleteNode}
              onRenameFile={onRenameFile}
              onRenameFolder={onRenameFolder}
              depth={0}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
