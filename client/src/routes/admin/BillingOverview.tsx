import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, AlertTriangle, Ban, Pencil } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/utils";

const SUB_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  trialing: "neutral",
  past_due: "warning",
  cancelled: "danger",
};

export function BillingOverview() {
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState<any | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: api.billing.plans });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.billing.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Plan updated", variant: "success" });
      setEditPlan(null);
    },
    onError: (err) => toast({ title: "Could not update plan", description: (err as ApiError).message, variant: "error" }),
  });
  const { data: companies, isLoading, isError } = useQuery({ queryKey: ["companies", "", ""], queryFn: () => api.companies.list() });

  const subscribeMutation = useMutation({
    mutationFn: ({ companyId, planId }: { companyId: string; planId: string }) => api.billing.subscribe(companyId, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Subscription created", variant: "success" });
      setAssignFor(null);
    },
    onError: (err) => toast({ title: "Could not create subscription", description: (err as ApiError).message, variant: "error" }),
  });

  const overdueMutation = useMutation({
    mutationFn: (companyId: string) => api.billing.markOverdue(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Marked as overdue", description: "Client notified.", variant: "success" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (companyId: string) => api.billing.cancel(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Subscription cancelled", variant: "success" });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500">Subscription plans and payment status per client.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(plans ?? []).map((plan: any) => (
          <Card key={plan.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  {plan.priceMonthly > 0 ? `${formatCurrency(plan.priceMonthly)}/mo` : "Custom pricing"} · up to {plan.maxSites} site
                  {plan.maxSites > 1 ? "s" : ""}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditPlan(plan)} title="Edit plan">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm text-gray-600">
                {(plan.featuresJson as string[]).map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              {plan.canSelfPublish && (
                <Badge variant="default" className="mt-3">
                  Self-publish enabled
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editPlan} onOpenChange={(open) => !open && setEditPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editPlan?.name}</DialogTitle>
          </DialogHeader>
          {editPlan && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                updatePlanMutation.mutate({
                  id: editPlan.id,
                  data: {
                    name: form.get("name"),
                    priceMonthly: Number(form.get("priceMonthly")),
                    maxSites: Number(form.get("maxSites")),
                    canSelfPublish: form.get("canSelfPublish") === "on",
                    featuresJson: String(form.get("features"))
                      .split("\n")
                      .map((f) => f.trim())
                      .filter(Boolean),
                  },
                });
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Plan name</Label>
                <Input id="name" name="name" defaultValue={editPlan.name} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="priceMonthly">Price (£/mo)</Label>
                  <Input id="priceMonthly" name="priceMonthly" type="number" min="0" step="0.01" defaultValue={editPlan.priceMonthly} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="maxSites">Max sites</Label>
                  <Input id="maxSites" name="maxSites" type="number" min="1" defaultValue={editPlan.maxSites} required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="features">Features (one per line)</Label>
                <textarea
                  id="features"
                  name="features"
                  defaultValue={(editPlan.featuresJson as string[]).join("\n")}
                  rows={4}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Switch name="canSelfPublish" defaultChecked={editPlan.canSelfPublish} />
                Allow client self-publish on this plan
              </label>
              <DialogFooter>
                <Button type="submit" loading={updatePlanMutation.isPending}>
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Client subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <LoadingState />}
          {isError && <ErrorState message="Could not load companies." />}
          {companies && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c: any) => {
                  const subscription = c.subscriptions?.[0];
                  return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-gray-900">{c.name}</TableCell>
                    <TableCell>{c.plan?.name ?? "No plan"}</TableCell>
                    <TableCell>
                      {subscription ? (
                        <Badge variant={SUB_VARIANT[subscription.status] ?? "neutral"}>
                          {subscription.status.replace("_", " ")}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">No subscription</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Dialog open={assignFor === c.id} onOpenChange={(open) => setAssignFor(open ? c.id : null)}>
                          <Button size="sm" variant="outline" onClick={() => setAssignFor(c.id)}>
                            <CreditCard className="h-3.5 w-3.5" /> {c.plan ? "Change plan" : "Assign plan"}
                          </Button>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Assign a plan to {c.name}</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col gap-2">
                              {(plans ?? []).map((plan: any) => (
                                <button
                                  key={plan.id}
                                  onClick={() => subscribeMutation.mutate({ companyId: c.id, planId: plan.id })}
                                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-brand-violet-300 hover:bg-brand-violet-50"
                                >
                                  <div>
                                    <p className="font-medium text-gray-900">{plan.name}</p>
                                    <p className="text-xs text-gray-500">{formatCurrency(plan.priceMonthly)}/mo</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                            <DialogFooter />
                          </DialogContent>
                        </Dialog>
                        <Button size="sm" variant="ghost" onClick={() => overdueMutation.mutate(c.id)} title="Mark overdue (demo)">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(c.id)} title="Cancel subscription">
                          <Ban className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
