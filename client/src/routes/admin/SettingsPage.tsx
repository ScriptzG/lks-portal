import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Mail, Upload, Building2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { data: settings, isLoading } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const { data: branding } = useQuery({ queryKey: ["settings", "branding"], queryFn: api.settings.branding });
  const { data: sentEmails } = useQuery({ queryKey: ["settings", "sent-emails"], queryFn: api.settings.sentEmails });

  const [values, setValues] = useState<Record<string, string>>({});

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => api.settings.uploadBrandLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "branding"] });
      toast({ title: "Logo updated", description: "Your new logo is live across the portal.", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not upload logo", description: (err as ApiError).message, variant: "error" }),
  });

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadLogoMutation.mutate(file);
    e.target.value = "";
  }

  useEffect(() => {
    if (settings) setValues(settings.values);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.settings.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Settings saved", variant: "success" });
    },
  });

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  if (isLoading) return <LoadingState label="Loading settings…" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Branding, integrations, and portal-wide defaults.</p>
      </div>

      {settings?.mockServicesActive && (
        <Card className="border-brand-violet-200 bg-brand-violet-50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-brand-violet-800">
            <Info className="h-4 w-4 shrink-0" />
            Mock services are active: deploys, billing, and email are simulated so the portal works with zero external
            accounts. Add real API keys below and set <code className="rounded bg-white/60 px-1">MOCK_SERVICES=false</code>{" "}
            on the server to go live.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Shown across the portal's login and navigation.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                  title="Upload logo"
                >
                  {branding?.brandLogoUrl ? (
                    <img src={branding.brandLogoUrl} alt="LKS Systems logo" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-6 w-6 text-gray-300" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Upload className="h-4 w-4 text-white" />
                  </span>
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <div className="text-sm text-gray-500">
                  <p>Shown in the sidebar, header and login screen.</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => logoInputRef.current?.click()}
                    loading={uploadLogoMutation.isPending}
                  >
                    {branding?.brandLogoUrl ? "Replace logo" : "Upload a logo"}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Primary colour</Label>
              <Input
                type="color"
                className="h-9 w-16 p-1"
                value={values.brandPrimaryColor || "#8B5CF6"}
                onChange={(e) => setValue("brandPrimaryColor", e.target.value)}
              />
              <p className="text-xs text-gray-400">Reserved for a future theming pass — not yet applied across the UI.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Real API keys — only used once mock services are disabled.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Netlify API token</Label>
              <Input type="password" value={values.netlifyApiToken ?? ""} onChange={(e) => setValue("netlifyApiToken", e.target.value)} placeholder="nfp_…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Stripe secret key</Label>
              <Input type="password" value={values.stripeSecretKey ?? ""} onChange={(e) => setValue("stripeSecretKey", e.target.value)} placeholder="sk_live_…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>SMTP host</Label>
                <Input value={values.smtpHost ?? ""} onChange={(e) => setValue("smtpHost", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>SMTP user</Label>
                <Input value={values.smtpUser ?? ""} onChange={(e) => setValue("smtpUser", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Global permissions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Auto-suspend on overdue payment</p>
                <p className="text-xs text-gray-500">Suspend client edit access automatically when payment is overdue.</p>
              </div>
              <Switch
                checked={values.autoSuspendOnOverdue !== "false"}
                onCheckedChange={(checked) => setValue("autoSuspendOnOverdue", String(checked))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Default self-publish for new sites</p>
                <p className="text-xs text-gray-500">New websites default to allowing clients to publish directly.</p>
              </div>
              <Switch
                checked={values.defaultSelfPublish === "true"}
                onCheckedChange={(checked) => setValue("defaultSelfPublish", String(checked))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Mock email outbox
            </CardTitle>
            <CardDescription>Emails the portal would have sent, captured here in mock mode.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto scrollbar-thin">
            {(!sentEmails || sentEmails.length === 0) && <EmptyState title="No emails sent yet" />}
            {sentEmails?.map((email: any) => (
              <div key={email.id} className="border-b border-gray-100 py-2 last:border-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{email.subject}</p>
                  <span className="text-xs text-gray-400">{formatDate(email.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-500">To: {email.to}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{email.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <Button onClick={() => saveMutation.mutate(values)} loading={saveMutation.isPending}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
