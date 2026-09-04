import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Building2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning"> = {
  active: "success",
  inactive: "neutral",
  prospect: "warning",
};

export function CompaniesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: companies, isLoading, isError } = useQuery({
    queryKey: ["companies", search, status],
    queryFn: () => api.companies.list({ search: search || undefined, status: status || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.companies.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Company created", variant: "success" });
      setDialogOpen(false);
    },
    onError: (err) => toast({ title: "Could not create company", description: (err as ApiError).message, variant: "error" }),
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      name: form.get("name"),
      domain: form.get("domain") || undefined,
      industry: form.get("industry") || undefined,
      status: form.get("status") || "prospect",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500">Manage the businesses LKS Systems builds and edits websites for.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New company
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New company</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Company name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="domain">Domain</Label>
                <Input id="domain" name="domain" placeholder="example.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" name="industry" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue="prospect"
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
                >
                  <option value="prospect">Prospect</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="submit" loading={createMutation.isPending}>
                  Create company
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Search companies…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading && <LoadingState />}
        {isError && <ErrorState message="Could not load companies." />}
        {companies && companies.length === 0 && <EmptyState title="No companies yet" description="Create your first company to get started." />}
        {companies && companies.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Websites</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c: any) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <Link to={`/admin/companies/${c.id}`} className="flex items-center gap-3 group">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                        {c.logoUrl ? (
                          <img src={c.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Building2 className="h-4 w-4 text-gray-300" />
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900 group-hover:text-brand-violet-600">{c.name}</span>
                        <p className="text-xs text-gray-400">{c.domain}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>{c.industry ?? "—"}</TableCell>
                  <TableCell>{c.plan?.name ?? "—"}</TableCell>
                  <TableCell>{c._count?.contacts ?? 0}</TableCell>
                  <TableCell>{c._count?.websites ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[c.status] ?? "neutral"}>{c.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
