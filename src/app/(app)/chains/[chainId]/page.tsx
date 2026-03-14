import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChainVisualizer } from "@/components/countdown/ChainVisualizer";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Event Chain — TTLeave" };

export default async function ChainPage({
  params,
}: {
  params: { chainId: string };
}) {
  const supabase = await createClient();

  // The chainId is the predecessor event id
  // Walk the chain: event → successor → successor → ...
  const chain: Array<{
    id: string;
    title: string;
    target_date: string;
    color: string;
    is_completed: boolean;
    link_type?: "relative" | "absolute";
    offset_days?: number | null;
  }> = [];

  let currentId: string | null = params.chainId;

  while (currentId) {
    const { data: event } = await supabase
      .from("events")
      .select("id, title, target_date, color, is_completed")
      .eq("id", currentId)
      .single();

    if (!event) break;

    const { data: link } = await supabase
      .from("event_chains")
      .select("successor_id, link_type, offset_days")
      .eq("predecessor_id", currentId)
      .single();

    chain.push({
      ...event,
      link_type: link?.link_type,
      offset_days: link?.offset_days,
    });

    currentId = link?.successor_id ?? null;
  }

  if (chain.length === 0) notFound();

  const activeIndex = chain.findIndex((e) => !e.is_completed);

  return (
    <div className="container max-w-5xl py-6 px-4">
      <Link
        href="/events"
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>

      <h1 className="mb-2 text-2xl font-bold">Event Chain</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {chain.length} events — {chain.filter((e) => e.is_completed).length} completed
      </p>

      <div className="overflow-x-auto rounded-xl border bg-card p-6">
        <ChainVisualizer
          events={chain}
          activeIndex={activeIndex === -1 ? chain.length - 1 : activeIndex}
        />
      </div>
    </div>
  );
}
