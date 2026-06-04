"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { UploadCloudIcon, FileIcon, XIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const ACCEPTED_TYPES = {
  "text/plain": [".txt"],
  "text/markdown": [".md", ".markdown"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

const MAX_SIZE = 50 * 1024 * 1024;

export function FileUpload({ onUploaded }: { onUploaded?: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        const reason = rejections[0].errors[0]?.message ?? "文件被拒绝";
        toast.error(reason);
        return;
      }
      const file = acceptedFiles[0];
      if (!file) return;

      setCurrentFile(file);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/knowledge/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.message || `上传失败 (${res.status})`);
        }

        toast.success("文档上传成功");
        setCurrentFile(null);
        onUploaded?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : "上传失败";
        toast.error(message);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading,
  });

  const clearFile = () => {
    if (!uploading) setCurrentFile(null);
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        <input {...getInputProps()} />
        <UploadCloudIcon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        {isDragActive ? (
          <p className="text-sm font-medium">松开以上传文件</p>
        ) : (
          <>
            <p className="text-sm font-medium">
              拖拽文件到此处，或点击选择
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              支持 TXT / Markdown / PDF / DOCX，单文件 ≤ 50MB
            </p>
          </>
        )}
      </div>

      {currentFile && (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm flex-1 truncate">{currentFile.name}</span>
          {uploading ? (
            <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={clearFile}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
