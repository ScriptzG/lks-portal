import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { Upload, FileCode, Rocket, Lock, Unlock, ShieldOff, Download, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { VisualSiteEditor } from "@/components/editor/VisualSiteEditor";
import { cn } from "@/lib/utils";

function languageForPath(filePath: string): string {
  if (filePath.endsWith(".html")) return "html";
  if (filePath.endsWith(".css")) return "css";
  if (filePath.endsWith(".js")) return "javascript";
  if (filePath.endsWith(".json")) return "json";
  return "plaintext";
}

export function WebsiteManage() {
  const { id = "" } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [previewNonce, setPreviewNonce] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: website, isLoading, isError } = useQuery({ queryKey: ["websites", id], queryFn: () => api.websites.get(id) });
  const { data: files } = useQuery({
    queryKey: ["websites", id, "files"],
    queryFn: () => api.websites.files(id),
    enabled: !!website && !website.filesLocked,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.websites.upload(id, file),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["websites", id] });
      queryClient.invalidateQueries({ queryKey: ["websites", id, "files"] });
      toast({ title: "Site uploaded", description: `${res.filesUploaded} files, ${res.fieldsFound} editable fields found.`, variant: "success" });
    },
    onError: (err) => toast({ title: "Upload failed", description: (err as ApiError).message, variant: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.websites.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["websites", id] });
      toast({ title: "Settings saved", variant: "success" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: (locked: boolean) => api.websites.lock(id, locked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["websites", id] });
      toast({ title: "Editing lock updated", variant: "success" });
    },
  });

  const saveFileMutation = useMutation({
    mutationFn: () => api.websites.writeFile(id, selectedFile!, editorContent),
    onSuccess: () => toast({ title: "File saved", variant: "success" }),
    onError: (err) => toast({ title: "Could not save file", description: (err as ApiError).message, variant: "error" }),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (filePath: string) => api.websites.deleteFile(id, filePath),
    onSuccess: (_data, filePath) => {
      queryClient.invalidateQueries({ queryKey: ["websites", id, "files"] });
      if (selectedFile === filePath) {
        setSelectedFile(null);
        setEditorContent("");
      }
      toast({ title: "File deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not delete file", description: (err as ApiError).message, variant: "error" }),
  });

  async function openFile(filePath: string) {
    setSelectedFile(filePath);
    try {
      const data = await api.websites.readFile(id, filePath);
      setEditorContent(data.encoding === "utf-8" ? data.content : "// Binary file — preview not available");
    } catch {
      setEditorContent("// Could not load file");
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  }

  if (isLoading) return <LoadingState label="Loading website…" />;
  if (isError || !website) return <ErrorState message="Website not found." />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gray-900">{website.name}</h1>
          <p className="text-sm text-gray-500">{website.company?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={website.status === "live" ? "success" : website.status === "pending_review" ? "warning" : "neutral"}>
            {website.status.replace("_", " ")}
          </Badge>
          <Button asChild>
            <Link to={`/admin/websites/${id}/deploy`}>
              <Rocket className="h-4 w-4" /> Deploy
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          {website.filesLocked ? (
            <Card className="flex flex-col items-center gap-3 p-10 text-center">
              <ShieldOff className="h-8 w-8 text-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-900">Code files are locked</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                  Raw HTML/CSS/JS is hidden to prevent an accidental markup edit. Use the Preview tab's click-to-edit
                  editor to make changes — it works exactly the same either way.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ filesLocked: false })} loading={updateMutation.isPending}>
                <Unlock className="h-3.5 w-3.5" /> Unlock files
              </Button>
            </Card>
          ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Files</CardTitle>
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} loading={uploadMutation.isPending}>
                  <Upload className="h-4 w-4" /> Upload zip
                </Button>
                <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleFileInputChange} />
              </CardHeader>
              <CardContent className="max-h-[28rem] overflow-y-auto scrollbar-thin p-2">
                {(!files || files.length === 0) && <EmptyState title="No files yet" description="Upload a zip to get started." />}
                {files?.map((f: any) => (
                  <div
                    key={f.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-md pl-2 pr-1 hover:bg-gray-100",
                      selectedFile === f.filePath && "bg-brand-violet-50",
                    )}
                  >
                    <button
                      onClick={() => openFile(f.filePath)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm text-gray-700",
                        selectedFile === f.filePath && "text-brand-violet-700",
                      )}
                    >
                      <FileCode className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{f.filePath}</span>
                    </button>
                    <a
                      href={f.storageUrl}
                      download={f.filePath.split("/").pop()}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete ${f.filePath}? This can't be undone.`)) deleteFileMutation.mutate(f.filePath);
                      }}
                      className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="flex flex-col overflow-hidden">
              {selectedFile ? (
                <>
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                    <span className="text-sm font-medium text-gray-700">{selectedFile}</span>
                    <Button size="sm" onClick={() => saveFileMutation.mutate()} loading={saveFileMutation.isPending}>
                      Save
                    </Button>
                  </div>
                  <Editor
                    height="28rem"
                    language={languageForPath(selectedFile)}
                    value={editorContent}
                    onChange={(value) => setEditorContent(value ?? "")}
                    options={{ minimap: { enabled: false }, fontSize: 13 }}
                  />
                </>
              ) : (
                <EmptyState title="Select a file" description="Choose a file on the left to view or edit it." />
              )}
            </Card>
          </div>
          )}
        </TabsContent>

        <TabsContent value="preview">
          <div className="mb-2 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setPreviewNonce((n) => n + 1)}>
              Refresh preview
            </Button>
          </div>
          {/* Admins get the exact same click-to-edit surface a client does — the editing lock
              (below, in Settings) only blocks the client's own draft saves server-side, so an
              admin can always make a change here, including on the client's behalf. Keyed on
              previewNonce so "Refresh preview" can force a full reload after a raw Files-tab
              edit, which this iframe otherwise has no way to know happened. */}
          <VisualSiteEditor key={previewNonce} websiteId={id} heightClassName="h-[36rem]" />
        </TabsContent>

        <TabsContent value="settings">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Deployment settings</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  updateMutation.mutate({
                    domainUrl: form.get("domainUrl") || undefined,
                    netlifySiteId: form.get("netlifySiteId") || undefined,
                  });
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="domainUrl">Live domain</Label>
                  <Input id="domainUrl" name="domainUrl" defaultValue={website.domainUrl ?? ""} placeholder="https://example.com" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="netlifySiteId">Netlify site ID</Label>
                  <Input id="netlifySiteId" name="netlifySiteId" defaultValue={website.netlifySiteId ?? ""} placeholder="(mock deploys auto-generate one)" />
                </div>
                <Button type="submit" className="self-start" loading={updateMutation.isPending}>
                  Save
                </Button>
              </form>

              <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Allow client self-publish</p>
                  <p className="text-xs text-gray-500">Client can push changes live without LKS review.</p>
                </div>
                <Switch
                  checked={website.allowSelfPublish}
                  onCheckedChange={(checked) => updateMutation.mutate({ allowSelfPublish: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2">
                  {website.editLocked ? <Lock className="h-4 w-4 text-red-500" /> : <Unlock className="h-4 w-4 text-green-500" />}
                  <div>
                    <p className="text-sm font-medium text-gray-900">Editing lock</p>
                    <p className="text-xs text-gray-500">Prevents the client from editing or publishing.</p>
                  </div>
                </div>
                <Switch checked={website.editLocked} onCheckedChange={(checked) => lockMutation.mutate(checked)} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2">
                  <ShieldOff className={cn("h-4 w-4", website.filesLocked ? "text-red-500" : "text-green-500")} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Lock code files</p>
                    <p className="text-xs text-gray-500">
                      Hides raw HTML/CSS/JS from the Files tab for everyone, admins included. The Preview tab's
                      click-to-edit editor keeps working regardless.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={website.filesLocked}
                  onCheckedChange={(checked) => updateMutation.mutate({ filesLocked: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
