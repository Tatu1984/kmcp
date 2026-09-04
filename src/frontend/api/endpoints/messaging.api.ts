import { api, type ApiResult } from "../client";

type Query = Record<string, string | number | boolean | undefined>;

/**
 * The channels the API can actually put a message onto.
 *
 * `IN_APP` is deliberately absent: those are the bell's rows, written by the
 * notifications module, and nothing in the portal sends one.
 */
export type MessageChannel = "SMS" | "WHATSAPP" | "EMAIL";

export interface ChannelStatus {
  channel: MessageChannel;
  /** msg91 | whatsapp-cloud | resend. */
  provider: string;
  /** False when this deployment holds no credentials for it. */
  configured: boolean;
}

/** One delivery attempt, as the log shows it. The address is masked server-side. */
export interface ApiDelivery {
  id: string;
  template: string;
  channel: MessageChannel;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
  recipient: string;
  recipientUserId: string;
  title: string;
  providerRef?: string;
  failureReason?: string;
  sentAt?: string;
  createdAt: string;
}

/**
 * What came back from asking for a send.
 *
 * Deliberately not a boolean. A bulk re-send of forty receipts can be partly
 * successful, and a screen that reported "done" would be lying to the officer
 * about the eleven citizens who never heard from us.
 */
export interface DispatchSummary {
  requested: number;
  sent: number;
  failed: number;
  /** Asked for, but this deployment has no credentials for them. */
  unconfiguredChannels: MessageChannel[];
  /** A sample, capped server-side. The delivery log has them all. */
  deliveries: ApiDelivery[];
}

export interface DeliveryListQuery extends Query {
  channel?: MessageChannel;
  status?: string;
  template?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const messagingApi = {
  /** Which channels this deployment can send on, and the template catalogue. */
  channels: (): Promise<ApiResult<{ channels: ChannelStatus[]; templates: { key: string; description: string }[] }>> =>
    api.get<{ channels: ChannelStatus[]; templates: { key: string; description: string }[] }>(
      "/messaging/channels",
    ),

  /**
   * Re-send a receipt. Takes payment ids, session ids or both — the sessions
   * screen holds session ids and the payments screen holds payment ids, and
   * neither should have to look up the other to send a document.
   */
  sendReceipts: (body: { paymentIds?: string[]; sessionIds?: string[]; channels: MessageChannel[] }) =>
    api.post<DispatchSummary>("/messaging/receipts", body),

  /** `issued` sends the pass itself; `renewal` prompts the holder to buy the next. */
  sendPasses: (body: { passIds: string[]; kind?: "issued" | "renewal"; channels: MessageChannel[] }) =>
    api.post<DispatchSummary>("/messaging/passes", body),

  sendAnnouncement: (body: {
    citizenIds: string[];
    title: string;
    body: string;
    url?: string;
    channels: MessageChannel[];
  }) => api.post<DispatchSummary>("/messaging/announcements", body),

  /** To the signed-in account only. There is no recipient field, by design. */
  emailReport: (body: {
    reportName: string;
    format: string;
    rangeLabel?: string;
    rowCount?: number;
    url?: string;
  }) => api.post<DispatchSummary>("/messaging/reports/email", body),

  deliveries: (query: DeliveryListQuery = {}) =>
    api.get<ApiDelivery[]>("/messaging/deliveries", { query }),
};

/**
 * Turns a dispatch summary into the sentence an operator should read.
 *
 * Lives here rather than in each screen so that seven "Re-send" controls cannot
 * describe the same partial outcome seven different ways — and so that no
 * screen is tempted to report a flat success when half the messages failed.
 */
export function describeDispatch(summary: DispatchSummary): { ok: boolean; title: string; description?: string } {
  if (summary.sent > 0 && summary.failed === 0) {
    return { ok: true, title: summary.sent === 1 ? "Message sent" : `${summary.sent} messages sent` };
  }

  if (summary.sent > 0) {
    return {
      ok: true,
      title: `${summary.sent} sent, ${summary.failed} could not be delivered`,
      description: firstReason(summary),
    };
  }

  if (summary.unconfiguredChannels.length > 0) {
    return {
      ok: false,
      title: "Nothing was sent",
      description: `This deployment has no credentials for ${summary.unconfiguredChannels
        .map(channelLabel)
        .join(" or ")}.`,
    };
  }

  return { ok: false, title: "Nothing was sent", description: firstReason(summary) };
}

function firstReason(summary: DispatchSummary): string | undefined {
  return summary.deliveries.find((d) => d.failureReason)?.failureReason;
}

export function channelLabel(channel: MessageChannel): string {
  return channel === "WHATSAPP" ? "WhatsApp" : channel === "SMS" ? "SMS" : "email";
}
