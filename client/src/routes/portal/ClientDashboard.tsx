import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LifeBuoy, PenSquare } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { GlassBackground } from "@/components/GlassBackground";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning"> = {
  live: "success",
  draft: "neutral",
  pending_review: "warning",
};

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function ClientDashboard() {
  const [supportOpen, setSupportOpen] = useState(false);
  const { toast } = useToast();
  const { data, isLoading, isError } = useQuery({ queryKey: ["dashboard", "client"], queryFn: api.dashboard.client });

  const supportMutation = useMutation({
    mutationFn: (message: string) => api.notifications.supportRequest(message),
    onSuccess: () => {
      toast({ title: "Message sent", description: "LKS Systems will get back to you shortly.", variant: "success" });
      setSupportOpen(false);
    },
  });

  function handleSupportSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    supportMutation.mutate(String(form.get("message")));
  }

  if (isLoading) return <LoadingState label="Loading your dashboard…" />;
  if (isError || !data) return <ErrorState message="Could not load your dashboard." />;

  const liveCount = data.websites.filter((w: any) => w.status === "live").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-black p-6 text-white sm:p-8">
        <GlassBackground />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-violet-300">
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              {timeOfDayGreeting()}
              {data.company ? `, ${data.company.name}` : ""}.
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              {data.websites.length === 0
                ? "LKS Systems will set up your website here."
                : liveCount > 0
                ? `${liveCount} of ${data.websites.length} ${data.websites.length === 1 ? "site is" : "sites are"} live.`
                : "Your site is being built — nothing's live yet."}
            </p>
          </div>
          <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setSupportOpen(true)}
            >
              <LifeBuoy className="h-4 w-4" /> Request support
            </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request support</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSupportSubmit} className="flex flex-col gap-4">
              <Textarea name="message" required placeholder="How can LKS Systems help?" rows={4} />
              <DialogFooter>
                <Button type="submit" loading={supportMutation.isPending}>
                  Send
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {data.websites.length === 0 && <EmptyState title="No websites yet" description="LKS Systems will set up your website here." />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.websites.map((w: any) => {
          const lastDeploy = w.deployments?.[0];
          return (
            <Card key={w.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{w.name}</CardTitle>
                <Badge variant={STATUS_VARIANT[w.status] ?? "neutral"}>{w.status.replace("_", " ")}</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-xs text-gray-500">
                  Last published {formatDate(w.lastDeployedAt)}
                  {lastDeploy?.triggeredBy?.email ? ` by ${lastDeploy.triggeredBy.email}` : ""}
                </p>
                {w.editLocked && <p className="text-xs font-medium text-red-500">Editing is currently locked by LKS Systems.</p>}
                {w.editLocked ? (
                  <Button disabled>
                    <PenSquare className="h-4 w-4" /> Edit my website
                  </Button>
                ) : (
                  <Button asChild>
                    <Link to={`/portal/edit/${w.id}`}>
                      <PenSquare className="h-4 w-4" /> Edit my website
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
