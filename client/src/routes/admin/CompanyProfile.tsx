import { useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Mail, ShieldOff, ShieldCheck, Star, Upload, Building2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { MessageThread } from "@/components/MessageThread";
import { DocumentList } from "@/components/DocumentList";
import { TicketList } from "@/components/TicketList";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils";

export function CompanyProfile() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "overview";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: company, isLoading, isError } = useQuery({
    queryKey: ["companies", id],
    queryFn: () => api.companies.get(id),
  });

  const { data: clientUsers } = useQuery({ queryKey: ["adminClients"], queryFn: api.adminClients.list });
  const { data: invites } = useQuery({ queryKey: ["adminInvites"], queryFn: api.adminClients.invites });

  const createContact = useMutation({
    mutationFn: (data: any) => api.contacts.create({ ...data, companyId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", id] });
      toast({ title: "Contact added", variant: "success" });
      setContactDialogOpen(false);
    },
    onError: (err) => toast({ title: "Could not add contact", description: (err as ApiError).message, variant: "error" }),
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => api.adminClients.invite(email, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminInvites"] });
      toast({ title: "Invite sent", description: "An email with a login link has been queued.", variant: "success" });
      setInviteDialogOpen(false);
    },
    onError: (err) => toast({ title: "Could not send invite", description: (err as ApiError).message, variant: "error" }),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ userId, suspend }: { userId: string; suspend: boolean }) =>
      suspend ? api.adminClients.suspend(userId) : api.adminClients.reinstate(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminClients"] });
      toast({ title: "Access updated", variant: "success" });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => api.companies.uploadLogo(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Logo updated", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not upload logo", description: (err as ApiError).message, variant: "error" }),
  });

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadLogoMutation.mutate(file);
    e.target.value = "";
  }

  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const notesMutation = useMutation({
    mutationFn: (notes: string) => api.companies.update(id, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", id] });
      toast({ title: "Notes saved", variant: "success" });
      setNotesDraft(null);
    },
    onError: (err) => toast({ title: "Could not save notes", description: (err as ApiError).message, variant: "error" }),
  });

  if (isLoading) return <LoadingState label="Loading company…" />;
  if (isError || !company) return <ErrorState message="Company not found." />;

  const companyUsers = (clientUsers ?? []).filter((u: any) => u.companyId === id);
  const companyInvites = (invites ?? []).filter((i: any) => i.companyId === id);

  function handleAddContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createContact.mutate({
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      phone: form.get("phone") || undefined,
      jobTitle: form.get("jobTitle") || undefined,
      isPrimary: form.get("isPrimary") === "on",
    });
  }

  function handleInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    inviteMutation.mutate(String(form.get("email")));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => logoInputRef.current?.click()}
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
            title="Upload logo"
          >
            {company.logoUrl ? (
              <img src={company.logoUrl} alt={`${company.name} logo`} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-7 w-7 text-gray-300" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Upload className="h-5 w-5 text-white" />
            </span>
          </button>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          <div>
            <h1 className="font-display text-2xl font-semibold text-gray-900">{company.name}</h1>
            <p className="text-sm text-gray-500">{company.domain ?? "No domain set"}</p>
          </div>
        </div>
        <Badge variant={company.status === "active" ? "success" : company.status === "prospect" ? "warning" : "neutral"}>
          {company.status}
        </Badge>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="websites">Websites</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Textarea
                  rows={4}
                  value={notesDraft ?? company.notes ?? ""}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Internal notes about this client — not visible to them."
                />
                {notesDraft !== null && notesDraft !== (company.notes ?? "") && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => notesMutation.mutate(notesDraft)} loading={notesMutation.isPending}>
                      Save notes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNotesDraft(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Plan &amp; subscription</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Plan</span>
                  <span className="font-medium">{company.plan?.name ?? "None"}</span>
                </div>
                {company.subscriptions?.[0] && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Billing status</span>
                    <Badge
                      variant={
                        company.subscriptions[0].status === "active"
                          ? "success"
                          : company.subscriptions[0].status === "past_due"
                          ? "warning"
                          : company.subscriptions[0].status === "cancelled"
                          ? "danger"
                          : "neutral"
                      }
                    >
                      {company.subscriptions[0].status.replace("_", " ")}
                    </Badge>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Industry</span>
                  <span className="font-medium">{company.industry ?? "—"}</span>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link to="/admin/billing">Manage billing</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contacts</CardTitle>
              <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                <Button size="sm" onClick={() => setContactDialogOpen(true)}>
                  <Plus className="h-4 w-4" /> Add contact
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add contact</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddContact} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="firstName">First name</Label>
                        <Input id="firstName" name="firstName" required />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="lastName">Last name</Label>
                        <Input id="lastName" name="lastName" required />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" name="phone" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="jobTitle">Job title</Label>
                        <Input id="jobTitle" name="jobTitle" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" name="isPrimary" className="rounded border-gray-300" />
                      Primary contact
                    </label>
                    <DialogFooter>
                      <Button type="submit" loading={createContact.isPending}>
                        Add contact
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {company.contacts.length === 0 && <EmptyState title="No contacts yet" />}
              {company.contacts.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Job title</TableHead>
                      <TableHead>Primary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.contacts.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-gray-900">
                          {c.firstName} {c.lastName}
                        </TableCell>
                        <TableCell>{c.email}</TableCell>
                        <TableCell>{c.jobTitle ?? "—"}</TableCell>
                        <TableCell>{c.isPrimary && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="websites">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Websites</CardTitle>
              <Button asChild size="sm">
                <Link to="/admin/websites">Manage websites</Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {company.websites.length === 0 && <EmptyState title="No websites yet" />}
              {company.websites.map((w: any) => (
                <Link
                  key={w.id}
                  to={`/admin/websites/${w.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 hover:border-brand-violet-200 hover:bg-brand-violet-50"
                >
                  <span className="text-sm font-medium text-gray-900">{w.name}</span>
                  <Badge variant={w.status === "live" ? "success" : w.status === "pending_review" ? "warning" : "neutral"}>
                    {w.status}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Client logins</CardTitle>
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
                    <Mail className="h-4 w-4" /> Invite
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite a client user</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleInvite} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="inviteEmail">Email</Label>
                        <Input id="inviteEmail" name="email" type="email" required />
                      </div>
                      <DialogFooter>
                        <Button type="submit" loading={inviteMutation.isPending}>
                          Send invite
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {companyUsers.length === 0 && <EmptyState title="No client logins yet" />}
                {companyUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.email}</p>
                      <p className="text-xs text-gray-400">Last login: {formatDate(u.lastLoginAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.suspended ? <Badge variant="danger">Suspended</Badge> : <Badge variant="success">Active</Badge>}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => suspendMutation.mutate({ userId: u.id, suspend: !u.suspended })}
                        title={u.suspended ? "Reinstate access" : "Suspend access"}
                      >
                        {u.suspended ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending invites</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {companyInvites.length === 0 && <EmptyState title="No pending invites" />}
                {companyInvites.map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                    <span>{i.email}</span>
                    <span className="text-xs text-gray-400">Expires {formatDate(i.expiresAt)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageThread companyId={id} viewerRole="admin" otherPartyLabel={company.name} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketList companyId={id} viewerRole="admin" allowCreate />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList companyId={id} otherPartyLabel={company.name} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
