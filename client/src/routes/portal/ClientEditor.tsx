import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MousePointerClick, Rocket, Save, Send, ListChecks, History, RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { EditableFieldForm, type EditableFieldData } from "@/components/editor/EditableFieldForm";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";

interface EditorMessage {
  source: "lks-visual-editor";
  type: "ready" | "select" | "deselect" | "input" | "image-selected";
  fieldKey?: string;
  fieldType?: string;
  label?: string;
  value?: string;
  file?: File;
}

export function ClientEditor() {
  const { websiteId = "" } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: website, isLoading: websiteLoading, isError: websiteError } = useQuery({
    queryKey: ["websites", websiteId],
    queryFn: () => api.websites.get(websiteId),
  });
  const { data: fields, isLoading: fieldsLoading, isError: fieldsError } = useQuery({
    queryKey: ["websites", websiteId, "fields"],
    queryFn: () => api.fields.list(websiteId),
  });
  const { data: pages } = useQuery({ queryKey: ["websites", websiteId, "pages"], queryFn: () => api.websites.pages(websiteId) });

  const [view, setView] = useState<"visual" | "list">("visual");
  const [page, setPage] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  // Separate from previewNonce (which only ever bumps in list view) because a restore needs to
  // force-reload the Visual editor's live iframe too, not just the List view's static preview.
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  // Mirrors `values` so the unmount/exit handlers below — which can't rely on a state closure
  // captured back when the effect was set up — always see the latest edits.
  const valuesRef = useRef<Record<string, string>>({});
  const hasUnsavedRef = useRef(false);
  // Field ids touched since the last successful save. A site can have hundreds of editable
  // fields (one client's site has 900+), so a save must only ever ship the handful that actually
  // changed — sending every field's value on every keystroke was taking 10+ seconds and timing
  // out, which is almost certainly what clients were experiencing as "my edits aren't saving".
  const dirtyFieldIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (fields) {
      setValues(Object.fromEntries(fields.map((f: any) => [f.id, f.draftValue ?? f.currentValue ?? ""])));
    }
  }, [fields]);

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
    mutationFn: (fieldIds: string[]) => {
      const payload = fieldIds.map((id) => ({ id, draftValue: valuesRef.current[id] ?? "" }));
      return api.fields.saveDraft(websiteId, payload).then(() => fieldIds);
    },
    onSuccess: (savedIds) => {
      // Only clear the ids this particular request actually saved — a field edited again while
      // an earlier save for a *different* field was still in flight must stay marked dirty.
      savedIds.forEach((id) => dirtyFieldIdsRef.current.delete(id));
      if (dirtyFieldIdsRef.current.size === 0) {
        hasUnsavedRef.current = false;
        setHasUnsaved(false);
      }
      setLastSavedAt(new Date());
      // The List view's preview panel is a static iframe (not live-edited DOM like the
      // Visual editor), so it needs an explicit reload to reflect the saved draft.
      if (view === "list") setPreviewNonce((n) => n + 1);
    },
    onError: (err) => toast({ title: "Could not save draft", description: (err as ApiError).message, variant: "error" }),
  });

  function scheduleAutosave(fieldId: string) {
    dirtyFieldIdsRef.current.add(fieldId);
    hasUnsavedRef.current = true;
    setHasUnsaved(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = undefined;
      const ids = [...dirtyFieldIdsRef.current];
      if (ids.length > 0) saveDraftMutation.mutate(ids);
    }, 800);
  }

  // Flushes still-pending autosaved edits immediately rather than losing them — otherwise a
  // client who edits a field and leaves within the 800ms debounce window (clicking "Back to
  // dashboard", or just closing the tab) loses that last edit even though autosave "should" have
  // caught it. This was very likely the actual cause behind "my changes didn't save" reports.
  function flushPendingSave(): Promise<unknown> {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    const ids = [...dirtyFieldIdsRef.current];
    return ids.length > 0 ? saveDraftMutation.mutateAsync(ids) : Promise.resolve();
  }

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const ids = [...dirtyFieldIdsRef.current];
      if (ids.length === 0) return;
      // A normal fetch can be cut off mid-flight once the page starts unloading; `saveDraftOnExit`
      // uses `keepalive` so the request actually completes. Still warn the user in case it's slow
      // to land — better an extra confirmation click than a silently lost edit.
      const payload = ids.map((id) => ({ id, draftValue: valuesRef.current[id] ?? "" }));
      api.fields.saveDraftOnExit(websiteId, payload);
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushPendingSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId]);

  function handleFieldChange(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    scheduleAutosave(fieldId);
  }

  async function uploadImageForField(fieldId: string, fieldKey: string, file: File) {
    setUploadingFieldId(fieldId);
    try {
      const { path } = await api.websites.uploadAsset(websiteId, file);
      setValues((prev) => ({ ...prev, [fieldId]: path }));
      scheduleAutosave(fieldId);
      iframeRef.current?.contentWindow?.postMessage(
        { source: "lks-visual-editor-host", type: "set-value", fieldKey, value: path },
        window.location.origin,
      );
      // The visual iframe already updates itself live via the postMessage above; only the
      // List view's separate (non-interactive) preview iframe needs a hard reload.
      if (view === "list") setPreviewNonce((n) => n + 1);
    } catch (err) {
      toast({ title: "Upload failed", description: (err as ApiError).message, variant: "error" });
    } finally {
      setUploadingFieldId(null);
    }
  }

  // Listen for edits made directly inside the interactive preview iframe (click-to-edit).
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
        if (field) handleFieldChange(field.id, msg.value ?? "");
      } else if (msg.type === "image-selected" && msg.fieldKey && msg.file) {
        const field = fieldByKey.get(msg.fieldKey);
        if (field) uploadImageForField(field.id, msg.fieldKey, msg.file);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldByKey, websiteId]);

  const requestPublishMutation = useMutation({
    mutationFn: async () => {
      await flushPendingSave();
      return api.fields.requestPublish(websiteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["websites", websiteId] });
      toast({ title: "Publish requested", description: "LKS Systems will review and publish your changes.", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not request publish", description: (err as ApiError).message, variant: "error" }),
  });

  const publishNowMutation = useMutation({
    mutationFn: async () => {
      await flushPendingSave();
      return api.deployments.deploy(websiteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["websites", websiteId] });
      toast({ title: "Publishing now", description: "Your changes are going live.", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not publish", description: (err as ApiError).message, variant: "error" }),
  });

  const { data: snapshots } = useQuery({
    queryKey: ["websites", websiteId, "snapshots"],
    queryFn: () => api.fields.snapshots(websiteId),
  });

  const saveSnapshotMutation = useMutation({
    mutationFn: async () => {
      await flushPendingSave();
      return api.fields.saveSnapshot(websiteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["websites", websiteId, "snapshots"] });
      toast({ title: "Version saved", description: "You can restore it later from Version history.", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not save version", description: (err as ApiError).message, variant: "error" }),
  });

  const restoreSnapshotMutation = useMutation({
    mutationFn: (snapshotId: string) => api.fields.restoreSnapshot(websiteId, snapshotId),
    onSuccess: (result) => {
      hasUnsavedRef.current = false;
      setHasUnsaved(false);
      dirtyFieldIdsRef.current.clear();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setValues(Object.fromEntries(result.fields.map((f: any) => [f.id, f.draftValue ?? f.currentValue ?? ""])));
      setPreviewNonce((n) => n + 1);
      setRestoreNonce((n) => n + 1);
      toast({ title: "Version restored", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not restore version", description: (err as ApiError).message, variant: "error" }),
  });

  const formFields: EditableFieldData[] = useMemo(
    () => (fields ?? []).map((f: any) => ({ id: f.id, fieldKey: f.fieldKey, fieldType: f.fieldType, label: f.label, section: f.section })),
    [fields],
  );

  const resolveImageUrl = (value: string) =>
    value.startsWith("http") ? value : `/storage/websites/${websiteId}/files/${value}`;

  // Memoized so the iframe's `src` only changes (and the browser only reloads it) when the
  // page or an explicit refresh is requested — NOT on every parent re-render. Recomputing this
  // inline on each render (with a fresh cache-busting timestamp) was silently reloading the
  // visual editor iframe mid-keystroke and discarding in-progress edits before autosave could fire.
  const visualPreviewSrc = useMemo(
    () => (page ? api.websites.previewUrl(websiteId, { mode: "draft", file: page, edit: true }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [websiteId, page, restoreNonce],
  );
  const readOnlyPreviewSrc = useMemo(
    () => (page ? api.websites.previewUrl(websiteId, { mode: "draft", file: page }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [websiteId, page, restoreNonce],
  );
  const listPreviewSrc = useMemo(
    () => api.websites.previewUrl(websiteId, { mode: "draft", file: page ?? undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [websiteId, page, previewNonce],
  );

  if (websiteLoading || fieldsLoading) return <LoadingState label="Loading editor…" />;
  if (websiteError || fieldsError || !website) return <ErrorState message="Could not load this website." />;

  const locked = website.editLocked;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/portal" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gray-900">Editing {website.name}</h1>
          <p className="text-sm text-gray-500">
            {saveDraftMutation.isPending
              ? "Saving…"
              : hasUnsaved
              ? "Unsaved changes…"
              : lastSavedAt
              ? `Draft saved at ${lastSavedAt.toLocaleTimeString()}`
              : "Changes save automatically."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {website.status === "pending_review" && <Badge variant="warning">Pending review</Badge>}
          <Button variant="outline" onClick={() => flushPendingSave()} loading={saveDraftMutation.isPending} disabled={locked}>
            <Save className="h-4 w-4" /> Save draft
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={locked}>
                <History className="h-4 w-4" /> Version history
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => saveSnapshotMutation.mutate()}
                disabled={saveSnapshotMutation.isPending}
              >
                <Save className="h-4 w-4" /> Save current as a version
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                Saved versions {snapshots ? `(${snapshots.length}/2)` : ""}
              </DropdownMenuLabel>
              {snapshots && snapshots.length === 0 && (
                <p className="px-2.5 py-1.5 text-xs text-gray-400">
                  None yet — saving a new one keeps only the most recent 2.
                </p>
              )}
              {snapshots?.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => {
                    if (window.confirm(`Restore "${s.label}"? This replaces your current unsaved draft.`)) {
                      restoreSnapshotMutation.mutate(s.id);
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="flex flex-col">
                    <span>{s.label}</span>
                    <span className="text-xs text-gray-400">{formatDate(s.createdAt)}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {website.allowSelfPublish ? (
            <Button onClick={() => publishNowMutation.mutate()} loading={publishNowMutation.isPending} disabled={locked}>
              <Rocket className="h-4 w-4" /> Publish now
            </Button>
          ) : (
            <Button onClick={() => requestPublishMutation.mutate()} loading={requestPublishMutation.isPending} disabled={locked}>
              <Send className="h-4 w-4" /> Request publish
            </Button>
          )}
        </div>
      </div>

      {locked && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Editing is currently locked by LKS Systems. Contact support if you believe this is a mistake.
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as "visual" | "list")}>
          <TabsList>
            <TabsTrigger value="visual">
              <MousePointerClick className="mr-1.5 h-3.5 w-3.5 inline" /> Visual editor
            </TabsTrigger>
            <TabsTrigger value="list">
              <ListChecks className="mr-1.5 h-3.5 w-3.5 inline" /> Field list
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {view === "visual" && pages && pages.length > 1 && (
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

      {view === "visual" ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 bg-brand-violet-50 px-4 py-2 text-xs text-brand-violet-700">
            <span>
              {editingLabel ? (
                <>
                  Editing <strong>{editingLabel}</strong> — click elsewhere or press Esc when done.
                </>
              ) : (
                "Click any highlighted text or image on your website to edit it directly."
              )}
            </span>
          </div>
          {page && !locked && visualPreviewSrc ? (
            <iframe
              ref={iframeRef}
              key={page}
              title="Visual editor"
              src={visualPreviewSrc}
              className="h-[42rem] w-full border-0"
            />
          ) : page && readOnlyPreviewSrc ? (
            <iframe key={page} title="Preview (read-only, locked)" src={readOnlyPreviewSrc} className="h-[42rem] w-full border-0" />
          ) : (
            <p className="p-6 text-sm text-gray-500">No pages found for this website yet.</p>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            {formFields.length === 0 ? (
              <p className="text-sm text-gray-500">No editable fields have been set up on this site yet.</p>
            ) : (
              <EditableFieldForm
                fields={formFields}
                values={values}
                onChange={handleFieldChange}
                onImageUpload={(fieldId, file) => {
                  const field = (fields ?? []).find((f: any) => f.id === fieldId);
                  return uploadImageForField(fieldId, field?.fieldKey ?? "", file);
                }}
                uploadingFieldId={uploadingFieldId}
                resolveImageUrl={resolveImageUrl}
                disabled={locked}
              />
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Live preview
            </div>
            <iframe key={previewNonce} title="Live preview" src={listPreviewSrc} className="h-[40rem] w-full border-0" />
          </Card>
        </div>
      )}
    </div>
  );
}
