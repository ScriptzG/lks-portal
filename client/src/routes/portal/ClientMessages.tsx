import { useAuth } from "@/context/AuthContext";
import { MessageThread } from "@/components/MessageThread";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/state";

export function ClientMessages() {
  const { user } = useAuth();

  if (!user) return <LoadingState />;
  if (!user.companyId) return <ErrorState message="No company linked to this account." />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-gray-900">Messages</h1>
        <p className="text-sm text-gray-500">A direct line to your LKS Systems team.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversation with LKS Systems</CardTitle>
        </CardHeader>
        <CardContent>
          <MessageThread companyId={user.companyId} viewerRole="client" otherPartyLabel="LKS Systems" />
        </CardContent>
      </Card>
    </div>
  );
}
