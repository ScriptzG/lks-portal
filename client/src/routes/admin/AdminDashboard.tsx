import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Globe2, Rocket, PoundSterling, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassBackground } from "@/components/GlassBackground";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { formatCurrency, formatDate } from "@/lib/utils";

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function AdminDashboard() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["dashboard", "admin"], queryFn: api.dashboard.admin });

  if (isLoading) return <LoadingState label="Loading dashboard…" />;
  if (isError || !data) return <ErrorState message="Could not load the dashboard." />;

  const attentionCount = data.pendingApprovals.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-black p-6 text-white sm:p-8">
        <GlassBackground />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-violet-300">
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{timeOfDayGreeting()}.</h1>
            <p className="mt-1 text-sm text-gray-400">
              {attentionCount > 0
                ? `${attentionCount} ${attentionCount === 1 ? "site needs" : "sites need"} your review today.`
                : "Nothing needs your attention right now."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link to="/admin/companies">New company</Link>
            </Button>
            <Button asChild className="shadow-glow">
              <Link to="/admin/websites">
                Upload website <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total clients" value={data.totalClients} icon={Users} />
        <StatCard label="Live sites" value={data.activeSites} icon={Globe2} accent="green" />
        <StatCard label="Deploys this month" value={data.deploymentsThisMonth} icon={Rocket} accent="amber" />
        <StatCard label="MRR" value={formatCurrency(data.mrr)} icon={PoundSterling} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending approvals</CardTitle>
            {data.pendingApprovals.length > 0 && <Badge variant="warning">{data.pendingApprovals.length}</Badge>}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.pendingApprovals.length === 0 && <EmptyState title="Nothing waiting on you" />}
            {data.pendingApprovals.map((site: any) => (
              <Link
                key={site.id}
                to={`/admin/websites/${site.id}/deploy`}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 hover:border-brand-violet-200 hover:bg-brand-violet-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{site.name}</p>
                  <p className="text-xs text-gray-500">{site.company?.name}</p>
                </div>
                <Badge variant="warning">Review</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.recentDeployments.length === 0 && data.recentNotifications.length === 0 && (
              <EmptyState title="No activity yet" />
            )}
            {data.recentDeployments.slice(0, 6).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-gray-800">
                    <span className="font-medium">{d.website?.company?.name}</span> deployed{" "}
                    <span className="font-medium">{d.website?.name}</span>
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(d.createdAt)}</p>
                </div>
                <Badge
                  variant={d.status === "live" ? "success" : d.status === "failed" ? "danger" : "neutral"}
                >
                  {d.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
