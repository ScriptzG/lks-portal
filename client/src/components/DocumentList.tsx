import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, FileImage, FileArchive, File as FileIcon, Upload, Trash2, Download } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { useAuth } from "@/context/AuthContext";
import { cn, formatDate } from "@/lib/utils";

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(mimeType?: string | null) {
  if (!mimeType) return FileIcon;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return FileArchive;
  if (mimeType.includes("pdf") || mimeType.startsWith("text/") || mimeType.includes("word")) return FileText;
  return FileIcon;
}

export function DocumentList({ companyId, otherPartyLabel }: { companyId: string; otherPartyLabel: string }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", companyId],
    queryFn: () => api.documents.list(companyId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.documents.upload(companyId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", companyId] });
      toast({ title: "File uploaded", variant: "success" });
    },
    onError: (err) => toast({ title: "Upload failed", description: (err as ApiError).message, variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.documents.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", companyId] });
      toast({ title: "File removed", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not remove file", description: (err as ApiError).message, variant: "error" }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Contracts, briefs, invoices, brand assets — shared between LKS Systems and {otherPartyLabel}.</p>
        <Button size="sm" onClick={() => fileInputRef.current?.click()} loading={uploadMutation.isPending}>
          <Upload className="h-4 w-4" /> Upload file
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>

      {isLoading && <LoadingState label="Loading files…" />}
      {documents && documents.length === 0 && <EmptyState title="No files shared yet" description="Uploaded files will appear here for both sides to see." />}

      <div className="flex flex-col gap-2">
        {documents?.map((doc: any) => {
          const Icon = iconFor(doc.mimeType);
          const isMine = doc.uploadedById === user?.id;
          const canDelete = user?.role === "admin" || isMine;
          return (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 transition-colors hover:border-brand-violet-200 hover:bg-brand-violet-50/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-violet-100 text-brand-violet-700">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{doc.fileName}</p>
                <p className="text-xs text-gray-400">
                  {formatBytes(doc.sizeBytes)} · Uploaded by {isMine ? "you" : doc.uploadedBy?.role === "admin" ? "LKS Systems" : otherPartyLabel} ·{" "}
                  {formatDate(doc.createdAt)}
                </p>
              </div>
              <a
                href={doc.url}
                download={doc.fileName}
                target="_blank"
                rel="noreferrer"
                className={cn("rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-violet-600")}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
              {canDelete && (
                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  className="rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
