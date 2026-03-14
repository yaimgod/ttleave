export const queryKeys = {
  events: {
    all: ["events"] as const,
    list: (filters?: object) => ["events", "list", filters] as const,
    detail: (id: string) => ["events", id] as const,
    stats: (id: string) => ["events", id, "stats"] as const,
    chain: (id: string) => ["events", id, "chain"] as const,
  },
  comments: {
    byEvent: (eventId: string) => ["comments", eventId] as const,
  },
  chains: {
    detail: (chainId: string) => ["chains", chainId] as const,
    byEvent: (eventId: string) => ["chains", "event", eventId] as const,
  },
  adjustments: {
    byEvent: (eventId: string) => ["adjustments", eventId] as const,
  },
  nlpFeedback: {
    byUserEvent: (userId: string, eventId: string) =>
      ["nlp_feedback", userId, eventId] as const,
  },
  groups: {
    all: ["groups"] as const,
    list: () => ["groups", "list"] as const,
    detail: (id: string) => ["groups", id] as const,
    members: (id: string) => ["groups", id, "members"] as const,
    invite: (id: string) => ["groups", id, "invite"] as const,
  },
  profiles: {
    all: ["profiles"] as const,
    detail: (id: string) => ["profiles", id] as const,
  },
};
