import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { LoadingState, EmptyState } from "@/components/ui/state";

export function ClientExtras() {
  const { data: extras, isLoading } = useQuery({ queryKey: ["extras"], queryFn: api.extras.list });

  if (isLoading) return <LoadingState label="Loading…" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-gray-900">Extras</h1>
        <p className="text-sm text-gray-500">Useful links and resources from LKS Systems.</p>
      </div>

      {(!extras || extras.length === 0) && <EmptyState title="Nothing here yet" description="Check back soon." />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {extras?.map((extra: any) => (
          <a key={extra.id} href={extra.url} target="_blank" rel="noreferrer" className="block">
            <Card className="flex h-full flex-col gap-2 p-4 transition-shadow hover:shadow-lifted">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{extra.icon || "🔗"}</span>
                <ExternalLink className="h-3.5 w-3.5 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-900">{extra.title}</p>
              {extra.description && <p className="text-xs text-gray-500">{extra.description}</p>}
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
