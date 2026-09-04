import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";

interface EditorMessage {
  source: "lks-visual-editor";
  type: "ready" | "select" | "deselect" | "input" | "image-selected";
  fieldKey?: string;
  fieldType?: string;
  label?: string;
  value?: string;
  file?: File;
}

interface VisualSiteEditorProps {
  websiteId: string;
  /** When true, renders a read-only iframe instead — used for a client whose editing has been
   * locked by LKS Systems. The server enforces the same rule independently (a locked site
   * rejects a client's draft save even if this prop were somehow bypassed) — this only controls
   * whether the click-to-edit affordance is shown. */
  locked?: boolean;
  heightClassName?: string;
}

/**
 * The click-to-edit surface shared by the client portal's editor and the admin's own website
 * management page — an admin needs to be able to make the same direct edits a client would
 * (e.g. to demo the editor, or make a quick fix on a client's behalf), and duplicating this
 * iframe + postMessage + autosave wiring in two places would drift out of sync over time.
 */
export function VisualSiteEditor({ websiteId, locked, heightClassName = "h-[42rem]" }: VisualSiteEditorProps) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: fields } = useQuery({ queryKey: ["websites", websiteId, "fields"], queryFn: () => api.fields.list(websiteId) });
  const { data: pages } = useQuery({ queryKey: ["websites", websiteId, "pages"], queryFn: () => api.websites.pages(websiteId) });

  const [page, setPage] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (pages && pages.length > 0 && !page) {
      const home = pages.find((p) => /(^|\/)index\.html$/i.test(p.filePath));
      setPage((home ?? pages[0]).filePath);
    }
  }, [pages, page]);

  const fieldByKey = useMemo(() => {
    const map = new Map<string, any>();
    (fields ?? []).forEach((f: any) => map.set(f.fieldKey, f));
    return map;
  }, [fields]);

  const saveDraftMutation = useMutation({
    mutationFn: (payload: { id: string; draftValue: string }[]) => api.fields.saveDraft(websiteId, payload),
    onSuccess: () => setLastSavedAt(new Date()),
    onError: (err) => toast({ title: "Could not save change", description: (err as ApiError).message, variant: "error" }),
  });

  // Batches rapid keystrokes into one request after a short pause, and only ever sends the
  // fields that actually changed — the endpoint applies each field independently, so there's no
  // need to resend every field's value on every save the way a full-form submit would.
  function scheduleSave(fieldId: string, value: string) {
    pendingRef.current[fieldId] = value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const payload = Object.entries(pendingRef.current).map(([id, draftValue]) => ({ id, draftValue }));
      pendingRef.current = {};
      saveDraftMutation.mutate(payload);
    }, 800);
  }

  async function uploadImageForField(fieldId: string, fieldKey: string, file: File) {
    try {
      const { path } = await api.websites.uploadAsset(websiteId, file);
      scheduleSave(fieldId, path);
      iframeRef.current?.contentWindow?.postMessage(
        { source: "lks-visual-editor-host", type: "set-value", fieldKey, value: path },
        window.location.origin,
      );
    } catch (err) {
      toast({ title: "Upload failed", description: (err as ApiError).message, variant: "error" });
    }
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent<EditorMessage>) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "lks-visual-editor") return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const msg = event.data;
      if (msg.type === "select") {
        setEditingLabel(msg.label ?? null);
      } else if (msg.type === "deselect") {
        setEditingLabel(null);
      } else if (msg.type === "input" && msg.fieldKey) {
        const field = fieldByKey.get(msg.fieldKey);
        if (field) scheduleSave(field.id, msg.value ?? "");
      } else if (msg.type === "image-selected" && msg.fieldKey && msg.file) {
        const field = fieldByKey.get(msg.fieldKey);
        if (field) uploadImageForField(field.id, msg.fieldKey, msg.file);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldByKey, websiteId]);

  // Memoized so the iframe only reloads on a page switch, not on every parent re-render — a
  // fresh cache-busting URL computed inline would silently reload mid-keystroke and discard
  // in-progress edits before the debounced autosave above could fire.
  const visualPreviewSrc = useMemo(
    () => (page ? api.websites.previewUrl(websiteId, { mode: "draft", file: page, edit: true }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [websiteId, page],
  );
  const readOnlyPreviewSrc = useMemo(
    () => (page ? api.websites.previewUrl(websiteId, { mode: "draft", file: page }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [websiteId, page],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {saveDraftMutation.isPending ? "Saving…" : lastSavedAt ? `Saved at ${lastSavedAt.toLocaleTimeString()}` : "Changes save automatically."}
        </p>
        {pages && pages.length > 1 && (
          <Select value={page ?? undefined} onValueChange={setPage}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Page" />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.filePath} value={p.filePath}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 bg-brand-violet-50 px-4 py-2 text-xs text-brand-violet-700">
          <span>
            {editingLabel ? (
              <>
                Editing <strong>{editingLabel}</strong> — click elsewhere or press Esc when done.
              </>
            ) : locked ? (
              "Editing is locked — showing a read-only preview."
            ) : (
              "Click any highlighted text or image on the site to edit it directly."
            )}
          </span>
        </div>
        {page && !locked && visualPreviewSrc ? (
          <iframe ref={iframeRef} key={page} title="Visual editor" src={visualPreviewSrc} className={`${heightClassName} w-full border-0`} />
        ) : page && readOnlyPreviewSrc ? (
          <iframe key={page} title="Preview (read-only)" src={readOnlyPreviewSrc} className={`${heightClassName} w-full border-0`} />
        ) : (
          <p className="p-6 text-sm text-gray-500">No pages found for this website yet.</p>
        )}
      </Card>
    </div>
  );
}
