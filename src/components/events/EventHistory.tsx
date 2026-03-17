"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { queryKeys } from "@/lib/query/keys";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/formatters";
import { Send, CalendarMinus, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type EventCommentInsert = Database["public"]["Tables"]["event_comments"]["Insert"];

type CommentEntry = {
  kind: "comment";
  id: string;
  created_at: string;
  content: string;
  author_name: string | null;
  author_avatar: string | null;
};

type AdjustmentEntry = {
  kind: "adjustment";
  id: string;
  created_at: string;
  reason_text: string;
  days_chosen: number;
  days_suggested: number;
};

type HistoryEntry = CommentEntry | AdjustmentEntry;

interface EventHistoryProps {
  eventId: string;
  canComment: boolean;
  isMutable: boolean;
}

export function EventHistory({ eventId, canComment, isMutable }: EventHistoryProps) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Comments query ──────────────────────────────────────────────────────────
  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: queryKeys.comments.byEvent(eventId),
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("event_comments")
        .select("*, profiles(full_name, avatar_url)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      return (data ?? []) as Array<{
        id: string;
        event_id: string;
        author_id: string;
        content: string;
        created_at: string;
        updated_at: string;
        profiles: { full_name: string | null; avatar_url: string | null } | null;
      }>;
    },
  });

  // ── Adjustments query (only when mutable) ───────────────────────────────────
  const { data: adjustments, isLoading: adjustmentsLoading } = useQuery({
    queryKey: queryKeys.adjustments.byEvent(eventId),
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("date_adjustments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      return (data ?? []) as Array<Database["public"]["Tables"]["date_adjustments"]["Row"]>;
    },
    enabled: isMutable,
  });

  // ── Realtime subscription for new comments ──────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`comments:${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_comments", filter: `event_id=eq.${eventId}` },
        () => { qc.invalidateQueries({ queryKey: queryKeys.comments.byEvent(eventId) }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, qc]);

  // ── Merge and sort entries chronologically ──────────────────────────────────
  const entries: HistoryEntry[] = [
    ...(comments ?? []).map((c): CommentEntry => ({
      kind: "comment",
      id: c.id,
      created_at: c.created_at,
      content: c.content,
      author_name: c.profiles?.full_name ?? null,
      author_avatar: c.profiles?.avatar_url ?? null,
    })),
    ...(isMutable ? (adjustments ?? []) : []).map((a): AdjustmentEntry => ({
      kind: "adjustment",
      id: a.id,
      created_at: a.created_at,
      reason_text: a.reason_text,
      days_chosen: a.days_chosen,
      days_suggested: a.days_suggested,
    })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Scroll to bottom when entries change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  // ── Comment submit ──────────────────────────────────────────────────────────
  const { register, handleSubmit, reset } = useForm<{ content: string }>();

  const mutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");
      const payload: EventCommentInsert = { event_id: eventId, author_id: user.id, content };
      const { error } = await supabase.from("event_comments").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: queryKeys.comments.byEvent(eventId) });
    },
    onError: () => toast.error("Failed to post comment"),
  });

  const isLoading = commentsLoading || (isMutable && adjustmentsLoading);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border bg-card px-4 py-3 flex flex-col gap-3">
      {/* Header */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Event history
      </h2>

      {/* Feed */}
      <div className="overflow-y-auto max-h-80 space-y-3 pr-1">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-1">Nothing here yet.</p>
        ) : (
          entries.map((entry) =>
            entry.kind === "comment" ? (
              <CommentRow key={`c-${entry.id}`} entry={entry} />
            ) : (
              <AdjustmentRow key={`a-${entry.id}`} entry={entry} />
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Comment input */}
      {canComment && (
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex gap-2 pt-1 border-t"
        >
          <Textarea
            {...register("content", { required: true })}
            placeholder="Add a comment… (Enter to send, Shift+Enter for new line)"
            className="resize-none text-sm"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit((v) => mutation.mutate(v))();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={mutation.isPending}
            className="self-end shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CommentRow({ entry }: { entry: CommentEntry }) {
  const initials = entry.author_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2) ?? "?";

  return (
    <div className="flex gap-2.5">
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarImage src={entry.author_avatar ?? undefined} />
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium">{entry.author_name ?? "User"}</span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-2.5 w-2.5" />
            {formatDateTime(entry.created_at)}
          </span>
        </div>
        <p className="text-sm leading-snug mt-0.5">{entry.content}</p>
      </div>
    </div>
  );
}

function AdjustmentRow({ entry }: { entry: AdjustmentEntry }) {
  const overrode = entry.days_chosen !== entry.days_suggested;

  return (
    <div className="flex gap-2.5">
      {/* Icon in place of avatar */}
      <div className="h-7 w-7 shrink-0 mt-0.5 rounded-full bg-destructive/10 flex items-center justify-center">
        <CalendarMinus className="h-3.5 w-3.5 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
            -{entry.days_chosen}d
          </Badge>
          {overrode && (
            <span className="text-[10px] text-muted-foreground">
              suggested {entry.days_suggested}d
            </span>
          )}
          <span className={cn("text-[10px] text-muted-foreground ml-auto")}>
            {formatDateTime(entry.created_at)}
          </span>
        </div>
        <p className="text-sm leading-snug mt-0.5 text-muted-foreground line-clamp-2">
          {entry.reason_text}
        </p>
      </div>
    </div>
  );
}
