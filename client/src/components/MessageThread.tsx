import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, MessageCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

interface Props {
  companyId: string;
  /** The current viewer's own role — determines which bubbles render as "mine". */
  viewerRole: "admin" | "client";
  /** Only admins may open a brand-new thread; a client can only reply to one already started. */
  otherPartyLabel: string;
}

export function MessageThread({ companyId, viewerRole, otherPartyLabel }: Props) {
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", companyId],
    queryFn: () => api.messages.list(companyId),
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (messages && messages.length > 0) {
      api.messages.markRead(companyId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, messages?.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => api.messages.send(companyId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", companyId] });
      setDraft("");
    },
    onError: (err) => toast({ title: "Could not send message", description: (err as ApiError).message, variant: "error" }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMutation.mutate(draft.trim());
  }

  const canSend = viewerRole === "admin" || (messages?.length ?? 0) > 0;

  if (isLoading) return <LoadingState label="Loading messages…" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-96 min-h-[10rem] flex-col gap-3 overflow-y-auto scrollbar-thin rounded-lg border border-gray-100 bg-gray-50 p-4">
        {messages && messages.length === 0 && (
          <EmptyState
            title="No messages yet"
            description={
              viewerRole === "admin"
                ? `Send the first message to start a conversation with ${otherPartyLabel}.`
                : "Your LKS Systems team hasn't started this conversation yet."
            }
          />
        )}
        {messages?.map((m: any) => {
          const isMine = m.senderRole === viewerRole;
          return (
            <div key={m.id} className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                  isMine ? "bg-brand-violet-600 text-white" : "bg-white text-gray-800 border border-gray-200",
                )}
              >
                {m.body}
              </div>
              <span className="mt-1 px-1 text-[11px] text-gray-400">
                {isMine ? "You" : m.senderRole === "admin" ? "LKS Systems" : otherPartyLabel} ·{" "}
                {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message…"
            rows={2}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" loading={sendMutation.isPending} disabled={!draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-400">
          <MessageCircle className="h-4 w-4" />
          Waiting for LKS Systems to start this conversation.
        </div>
      )}
    </div>
  );
}
