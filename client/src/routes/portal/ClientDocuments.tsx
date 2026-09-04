import { useAuth } from "@/context/AuthContext";
import { DocumentList } from "@/components/DocumentList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/state";

export function ClientDocuments() {
  const { user } = useAuth();

  if (!user) return <LoadingState />;
  if (!user.companyId) return <ErrorState message="No company linked to this account." />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500">Contracts, briefs and files shared with LKS Systems.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shared files</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentList companyId={user.companyId} otherPartyLabel="LKS Systems" />
        </CardContent>
      </Card>
    </div>
  );
}
