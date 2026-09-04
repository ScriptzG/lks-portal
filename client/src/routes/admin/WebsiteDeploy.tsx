import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Rocket, RotateCcw, ExternalLink } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  live: "success",
  building: "warning",
  pending: "warning",
  failed: "danger",
  rolled_back: "neutral",
};

export function WebsiteDeploy() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: deployments, isLoading, isError } = useQuery({
    queryKey: ["deployments", id],
    queryFn: () => api.deployments.list(id),
    refetchInterval: (query) => (query.state.data?.some((d: any) => d.status === "building" || d.status === "pending") ? 2000 : false),
  });
  const isBuilding = deployments?.some((d: any) => d.status === "building" || d.status === "pending") ?? false;
  const { data: website } = useQuery({
    queryKey: ["websites", id],
    queryFn: () => api.websites.get(id),
    refetchInterval: isBuilding ? 2000 : false,
  });

  const deployMutation = useMutation({
    mutationFn: () => api.deployments.deploy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments", id] });
      queryClient.invalidateQueries({ queryKey: ["websites", id] });
      toast({ title: "Deploy started", description: "Building your site now…", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not start deploy", description: (err as ApiError).message, variant: "error" }),
  });

  const rollbackMutation = useMutation({
    mutationFn: (deploymentId: string) => api.deployments.rollback(deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments", id] });
      toast({ title: "Rollback started", variant: "success" });
    },
    onError: (err) => toast({ title: "Rollback failed", description: (err as ApiError).message, variant: "error" }),
  });

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/admin/websites/${id}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to website
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gray-900">Deploy — {website?.name}</h1>
          <p className="text-sm text-gray-500">Push changes live and manage deployment history.</p>
        </div>
        <Button onClick={() => deployMutation.mutate()} loading={deployMutation.isPending}>
          <Rocket className="h-4 w-4" /> Deploy now
        </Button>
      </div>

      {website?.status === "pending_review" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm text-amber-800">The client has requested their latest edits be reviewed and published.</p>
            <Button size="sm" onClick={() => deployMutation.mutate()} loading={deployMutation.isPending}>
              Approve &amp; deploy
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Deployment history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <LoadingState />}
          {isError && <ErrorState message="Could not load deployments." />}
          {deployments && deployments.length === 0 && <EmptyState title="No deployments yet" />}
          {deployments && deployments.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Triggered by</TableHead>
                  <TableHead>Deployed</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[d.status] ?? "neutral"}>{d.status}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{d.trigger.replace("_", " ")}</TableCell>
                    <TableCell>{d.triggeredBy?.email ?? "—"}</TableCell>
                    <TableCell>{formatDate(d.deployedAt ?? d.createdAt)}</TableCell>
                    <TableCell>
                      {d.deployUrl ? (
                        <a href={d.deployUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-violet-600 hover:underline">
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {d.status === "live" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rollbackMutation.mutate(d.id)}
                          loading={rollbackMutation.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Rollback to this
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
