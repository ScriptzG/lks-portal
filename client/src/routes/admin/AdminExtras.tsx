import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ExternalLink, Eye, EyeOff } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";

export function AdminExtras() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data: extras, isLoading } = useQuery({ queryKey: ["extras"], queryFn: api.extras.list });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.extras.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extras"] });
      setShowForm(false);
      toast({ title: "Extra added", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not add extra", description: (err as ApiError).message, variant: "error" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, visibleToClients }: { id: string; visibleToClients: boolean }) =>
      api.extras.update(id, { visibleToClients }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["extras"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.extras.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extras"] });
      toast({ title: "Extra removed", variant: "success" });
    },
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      title: String(form.get("title") ?? ""),
      url: String(form.get("url") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      icon: String(form.get("icon") ?? "") || undefined,
    });
    e.currentTarget.reset();
  }

  if (isLoading) return <LoadingState label="Loading extras…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gray-900">Extras</h1>
          <p className="text-sm text-gray-500">Useful links and resources shown in every client's portal.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4" /> Add extra
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[4rem_1fr_1fr]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extra-icon">Icon</Label>
                <Input id="extra-icon" name="icon" placeholder="🔗" maxLength={4} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extra-title">Title</Label>
                <Input id="extra-title" name="title" required placeholder="Brand guidelines" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extra-url">Link</Label>
                <Input id="extra-url" name="url" required type="url" placeholder="https://…" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="extra-description">Description (optional)</Label>
              <Textarea id="extra-description" name="description" rows={2} placeholder="What this is / why it's useful." />
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={createMutation.isPending}>
                Add extra
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All extras</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(!extras || extras.length === 0) && (
            <EmptyState title="No extras yet" description="Add a link above — it'll show up in every client's portal." />
          )}
          {extras?.map((extra: any) => (
            <div
              key={extra.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-xl">{extra.icon || "🔗"}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-gray-900">{extra.title}</p>
                    <a href={extra.url} target="_blank" rel="noreferrer" className="shrink-0 text-gray-400 hover:text-brand-violet-600">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {extra.description && <p className="truncate text-xs text-gray-500">{extra.description}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  {extra.visibleToClients ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  <Switch
                    checked={extra.visibleToClients}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: extra.id, visibleToClients: checked })}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(extra.id)}
                  loading={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
