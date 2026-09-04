import { api, type ApiResult } from "../client";

/**
 * One alert, already rendered by the API.
 *
 * The server stores a template name and a payload so a future delivery module
 * can re-render the same alert for SMS or email. The portal is deliberately not
 * given that job: a title composed in the browser would drift from the one sent
 * to a phone, and the two must say the same thing.
 */
export interface ApiNotification {
  id: string;
  template: string;
  title: string;
  body?: string;
  /** Where the alert points in the portal, when it points anywhere. */
  href?: string;
  read: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (query: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}) =>
    api.get<ApiNotification[]>("/notifications", { query }),

  /** Just the badge number. Cheap enough to poll. */
  unreadCount: (): Promise<ApiResult<{ unread: number }>> =>
    api.get<{ unread: number }>("/notifications/unread-count"),

  markRead: (id: string) => api.post<ApiNotification>(`/notifications/${id}/read`),

  markAllRead: () => api.post<{ marked: number }>("/notifications/read-all"),

  dismiss: (id: string) => api.delete<{ dismissed: true }>(`/notifications/${id}`),
};
