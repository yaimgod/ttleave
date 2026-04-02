export type NotificationChannel = "email";

export interface NotificationActor {
  name: string;
  email: string;
}

export type NotificationEventType =
  | "date_change"
  | "comment"
  | "member_join";

export interface NotificationPayload {
  type: NotificationEventType;
  actor: NotificationActor;
  groupName: string;
  eventTitle?: string;
  oldDate?: string;
  newDate?: string;
  commentText?: string;
  appUrl: string;
  eventId?: string;
}

export interface NotificationProvider {
  channel: NotificationChannel;
  isConfigured(): boolean;
  send(to: string, payload: NotificationPayload): Promise<void>;
}
