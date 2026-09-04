import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Send, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "warning" | "default" | "neutral"> = {
  open: "warning",
  answered: "default",
  closed: "neutral",
};

interface Props {
  /** Scope to one company's tickets (client portal, or an admin viewing one company's tab). Omit
   * for the admin's global inbox across every company. */
  companyId?: string;
  viewerRole: "admin" | "client";
  /** Lets a client (or an admin acting for a specific company) open a new ticket. */
  allowCreate?: boolean;
}

export function TicketList({ companyId, viewerRole, allowCreate }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPriority, setNewPriority] = useState<"normal" | "urgent">("normal");
  const [reply, setReply] = useState("");

  const listKey = companyId ? ["tickets", "company", companyId] : ["tickets", "all"];
  const { data: tickets, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => (companyId ? api.tickets.listForCompany(companyId) : api.tickets.listAll()),
    refetchInterval: 15000,
  });

  const { data: openTicket } = useQuery({
    queryKey: ["tickets", openId],
    queryFn: () => api.tickets.get(openId!),
    enabled: !!openId,
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (data: { subject: string; message: string; priority: "normal" | "urgent" }) =>
      api.tickets.create(companyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      setShowNewForm(false);
      setNewPriority("normal");
      toast({ title: "Ticket submitted", description: "LKS Systems will be in touch.", variant: "success" });
    },
    onError: (err) => toast({ title: "Could not submit ticket", description: (err as ApiError).message, variant: "error" }),
  });

  const replyMutation = useMutation({
    mutationFn: (message: string) => api.tickets.reply(openId!, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", openId] });
      queryClient.invalidateQueries({ queryKey: listKey });
      setReply("");
    },
    onError: (err) => toast({ title: "Could not send reply", description: (err as ApiError).message, variant: "error" }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "open" | "answered" | "closed") => api.tickets.setStatus(openId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", openId] });
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      subject: String(form.get("subject") ?? ""),
      message: String(form.get("message") ?? ""),
      priority: newPriority,
    });
    e.currentTarget.reset();
  }

  function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    replyMutation.mutate(reply.trim());
  }

  if (isLoading) return <LoadingState label="Loading tickets…" />;

  return (
    <div className="flex flex-col gap-4">
      {allowCreate && companyId && (
        <div>
          {!showNewForm ? (
            <Button variant="outline" onClick={() => setShowNewForm(true)}>
              <Plus className="h-4 w-4" /> New ticket
            </Button>
          ) : (
            <Card className="p-4">
              <form onSubmit={handleCreate} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ticket-subject">Subject</Label>
                    <Input id="ticket-subject" name="subject" required placeholder="What's this about?" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ticket-priority">Priority</Label>
                    <Select value={newPriority} onValueChange={(v) => setNewPriority(v as "normal" | "urgent")}>
                      <SelectTrigger id="ticket-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ticket-message">What's going on?</Label>
                  <Textarea id="ticket-message" name="message" required rows={4} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" loading={createMutation.isPending}>
                    Submit ticket
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowNewForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}

      {(!tickets || tickets.length === 0) && (
        <EmptyState
          title="No tickets yet"
          description={allowCreate ? "Submit one above and it'll show up here." : "Nothing's come in yet."}
        />
      )}

      <div className="flex flex-col gap-2">
        {tickets?.map((t: any) => {
          const isOpen = openId === t.id;
          return (
            <Card key={t.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : t.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">{t.subject}</span>
                    {t.priority === "urgent" && <Badge variant="danger">Urgent</Badge>}
                  </div>
                  <span className="truncate text-xs text-gray-500">
                    {!companyId && <>{t.company?.name} · </>}
                    {new Date(t.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUS_VARIANT[t.status] ?? "neutral"}>{t.status}</Badge>
                  <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", isOpen && "rotate-180")} />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  {!openTicket ? (
                    <LoadingState label="Loading conversation…" />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {viewerRole === "admin" && (
                        <div className="flex items-center justify-end gap-2">
                          <Label className="text-xs text-gray-500">Status</Label>
                          <Select value={openTicket.status} onValueChange={(v) => statusMutation.mutate(v as any)}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="answered">Answered</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto scrollbar-thin rounded-lg border border-gray-200 bg-white p-3">
                        <ThreadBubble
                          isMine={openTicket.createdBy?.role === viewerRole}
                          senderLabel={openTicket.createdBy?.role === "admin" ? "LKS Systems" : openTicket.company?.name ?? "Client"}
                          body={openTicket.message}
                          createdAt={openTicket.createdAt}
                        />
                        {openTicket.replies?.map((r: any) => (
                          <ThreadBubble
                            key={r.id}
                            isMine={r.senderRole === viewerRole}
                            senderLabel={r.senderRole === "admin" ? "LKS Systems" : openTicket.company?.name ?? "Client"}
                            body={r.message}
                            createdAt={r.createdAt}
                          />
                        ))}
                      </div>

                      <form onSubmit={handleReply} className="flex items-end gap-2">
                        <Textarea
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Write a reply…"
                          rows={2}
                          className="flex-1 bg-white"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleReply(e);
                            }
                          }}
                        />
                        <Button type="submit" loading={replyMutation.isPending} disabled={!reply.trim()}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ThreadBubble({
  isMine,
  senderLabel,
  body,
  createdAt,
}: {
  isMine: boolean;
  senderLabel: string;
  body: string;
  createdAt: string;
}) {
  return (
    <div className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
          isMine ? "bg-brand-violet-600 text-white" : "border border-gray-200 bg-gray-50 text-gray-800",
        )}
      >
        {body}
      </div>
      <span className="mt-1 px-1 text-[11px] text-gray-400">
        {senderLabel} · {new Date(createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </span>
    </div>
  );
}
