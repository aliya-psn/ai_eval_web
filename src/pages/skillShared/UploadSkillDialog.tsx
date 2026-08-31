import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { adminSkillApi } from '@/api/admin/skill';
import { uploadRepo } from '@/api/repo/uploadRepo';
import { getHostWorkspaceKey } from '@/lib/host-workspace';

function isValidZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
}

interface UploadSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  namespaceId: string;
  onSuccess: () => void;
  initialFile?: File | null;
}
export function UploadSkillDialog({
  open,
  onOpenChange,
  namespaceId,
  onSuccess,
  initialFile,
}: UploadSkillDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialFileRef = useRef<File | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setError(null);
    setLoading(false);
    setIsDragOver(false);
    initialFileRef.current = null;
  }, []);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset],
  );

  const handleFileSelect = useCallback((selected: File | null) => {
    setError(null);
    setLoading(false);
    if (selected && !isValidZipFile(selected)) {
      setError('请选择有效的 .zip 文件');
      setFile(null);
      return;
    }
    setFile(selected);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files?.[0] ?? null);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      handleFileSelect(e.dataTransfer?.files?.[0] ?? null);
    },
    [handleFileSelect],
  );

  useEffect(() => {
    if (!open) {
      initialFileRef.current = null;
      return;
    }
    if (initialFile && initialFileRef.current !== initialFile) {
      initialFileRef.current = initialFile;
      handleFileSelect(initialFile);
    }
  }, [handleFileSelect, initialFile, open]);

  const handleUpload = useCallback(async () => {
    if (!file || !namespaceId) return;
    if (/\s/.test(file.name)) {
      setError('zip 包文件名不能包含空格');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const skillName = file.name.replace(/\.zip$/i, '').trim() || 'skill';
      const repoPath = await uploadRepo(file);
      const uploadedName = await adminSkillApi.upload(namespaceId, repoPath, {
        skillName,
        workspaceCode: getHostWorkspaceKey() || undefined,
      });
      toast.success(`Skill ${uploadedName || skillName} 上传成功`);
      handleClose(false);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setLoading(false);
    }
  }, [file, handleClose, namespaceId, onSuccess]);

  const canSubmit = !!file && !!namespaceId && !loading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>上传 Skill ZIP</DialogTitle>
          <DialogDescription>
            选择一个 .zip 文件导入 Skill 包。请确保 zip 包名称使用纯英文，且包内的说明文档必须命名为 SKILL.md。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 cursor-pointer transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {isDragOver
                ? '释放 .zip 文件以上传'
                : file
                  ? file.name
                  : '拖拽 .zip 文件到此处，或点击选择'}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive break-all whitespace-pre-wrap max-w-full overflow-hidden">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleUpload} disabled={!canSubmit}>
            {loading ? '上传中...' : '确认上传'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
