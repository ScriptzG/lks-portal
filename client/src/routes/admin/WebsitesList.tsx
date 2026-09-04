import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Globe2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning"> = {
  live: "success",
  draft: "neutral",
  pending_review: "warning",
};

export function WebsitesList() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: websites, isLoading, isError } = useQuery({ queryKey: ["websites"], queryFn: () => api.websites.list() });
  const { data: companies } = useQuery({ queryKey: ["companies", "", ""], queryFn: () => api.companies.list() });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.websites.create(data),
    onSuccess: (website) => {
      queryClient.invalidateQueries({ queryKey: ["websites"] });
      toast({ title: "Website created", description: "Now upload its files.", variant: "success" });
      setDialogOpen(false);
      navigate(`/admin/websites/${website.id}`);
    },
    onError: (err) => toast({ title: "Could not create website", description: (err as ApiError).message, variant: "error" }),
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      companyId: form.get("companyId"),
      name: form.get("name"),
      domainUrl: form.get("domainUrl") || undefined,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gray-900">Websites</h1>
          <p className="text-sm text-gray-500">Every site LKS Systems has built and manages.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New website
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New website</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="companyId">Company</Label>
                <select
                  id="companyId"
                  name="companyId"
                  required
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
                >
                  <option value="">Select a company…</option>
                  {(companies ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Site name</Label>
                <Input id="name" name="name" required placeholder="Main website" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="domainUrl">Live domain (optional)</Label>
                <Input id="domainUrl" name="domainUrl" placeholder="https://example.com" />
              </div>
              <DialogFooter>
                <Button type="submit" loading={createMutation.isPending}>
                  Create website
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        {isLoading && <LoadingState />}
        {isError && <ErrorState message="Could not load websites." />}
        {websites && websites.length === 0 && (
          <EmptyState title="No websites yet" description="Create a website record, then upload its files." />
        )}
        {websites && websites.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last deployed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {websites.map((w: any) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <Link to={`/admin/websites/${w.id}`} className="flex items-center gap-2 font-medium text-gray-900 hover:text-brand-violet-600">
                      <Globe2 className="h-4 w-4 text-gray-400" />
                      {w.name}
                    </Link>
                  </TableCell>
                  <TableCell>{w.company?.name}</TableCell>
                  <TableCell>{w._count?.editableFields ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[w.status] ?? "neutral"}>{w.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(w.lastDeployedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
