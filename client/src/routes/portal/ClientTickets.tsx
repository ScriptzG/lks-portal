import { useAuth } from "@/context/AuthContext";
import { TicketList } from "@/components/TicketList";
import { LoadingState, ErrorState } from "@/components/ui/state";

export function ClientTickets() {
  const { user } = useAuth();

  if (!user) return <LoadingState />;
  if (!user.companyId) return <ErrorState message="No company linked to this account." />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-gray-900">Support</h1>
        <p className="text-sm text-gray-500">Submit and track support tickets with LKS Systems.</p>
      </div>

      <TicketList companyId={user.companyId} viewerRole="client" allowCreate />
    </div>
  );
}
