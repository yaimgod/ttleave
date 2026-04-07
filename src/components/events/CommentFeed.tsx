"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query/keys";

type CommentWithProfile = {
  id: string;
  event_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils/formatters";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface CommentFeedProps {
  eventId: string;
  canComment: boolean;
}

export function CommentFeed({ eventId, canComment }: CommentFeedProps) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: comments, isLoading } = useQuery({
    queryKey: queryKeys.comments.byEvent(eventId),
    queryFn: async (): Promise<CommentWithProfile[]> => {
      const supabase = createClient();
      const { data } = await supabase
        .from("event_comments")
        .select("*, profiles(full_name, avatar_url)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      return (data ?? []) as CommentWithProfile[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`comments:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_comments",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.comments.byEvent(eventId) });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, qc]);

  // Scroll to bottom on new comments
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments?.length]);

  const { register, handleSubmit, reset } = useForm<{ content: string }>();

  const mutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
    },
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: queryKeys.comments.byEvent(eventId) });
    },
    onError: () => toast.error("Failed to post comment"),
  });

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">Comments</h3>

      <ScrollArea className="h-64 rounded-md border p-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : comments?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <div className="space-y-4">
            {comments?.map((comment) => {
              const profile = comment.profiles;
              const initials = profile?.full_name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2) ?? "?";
              return (
                <div key={comment.id} className="flex gap-2.5">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium">
                        {profile?.full_name ?? "User"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateTime(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm leading-snug">{comment.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {canComment && (
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex gap-2"
        >
          <Textarea
            {...register("content", { required: true })}
            placeholder="Add a comment…"
            className="resize-none"
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
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
