import { api, setTokens, deviceId, type ApiResult } from "../client";
import type { PermissionKey, Role } from "@/shared/constants/roles";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: "Bearer";
}

export interface Principal {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  vendorId?: string | null;
  attendantId?: string | null;
}

export interface LoginResponse {
  status: "authenticated" | "two_factor_required";
  challengeId?: string;
  tokens?: TokenPair;
  user?: Principal;
}

export interface MeResponse extends Principal {
  status: string;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  zoneIds: string[];
  /**
   * What this account may actually do, resolved from its role server-side.
   *
   * The portal gates on these rather than on the role code, because roles are
   * rows the authority edits — a deployment that branched on `role === "ADMIN"`
   * would be wrong the moment someone changed what ADMIN means.
   */
  permissions: PermissionKey[];
  /** True when the account may only operate inside `zoneIds`. */
  isZoneScoped: boolean;
  /** Unrestricted by definition; holds every permission in the catalogue. */
  isSuperuser: boolean;
}

/** A device bound to the signed-in account. */
export interface AuthDevice {
  id: string;
  platform: string;
  fingerprint: string;
  appVersion?: string | null;
  isActive: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
}

export const authApi = {
  /**
   * Returns `two_factor_required` with a challenge id for accounts with an
   * authenticator enrolled, which is mandatory for admin roles.
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      "/auth/login",
      { email, password, deviceFingerprint: deviceId(), platform: "web" },
      { anonymous: true },
    );
    if (data.tokens) setTokens(data.tokens);
    return data;
  },

  async verifyTwoFactor(challengeId: string, code: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      "/auth/two-factor/verify",
      { challengeId, code },
      { anonymous: true },
    );
    if (data.tokens) setTokens(data.tokens);
    return data;
  },

  me: (): Promise<ApiResult<MeResponse>> => api.get<MeResponse>("/auth/me"),

  async logout(): Promise<void> {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("kmcp.tokens") : null;
    const refreshToken = stored ? (JSON.parse(stored) as TokenPair).refreshToken : undefined;
    if (refreshToken) {
      await api.post("/auth/logout", { refreshToken }, { anonymous: true }).catch(() => undefined);
    }
    setTokens(null);
  },

  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    api.post("/auth/password/change", { currentPassword, newPassword, confirmPassword }),

  /**
   * Ends every session on this account, including the one making the call.
   *
   * The API has no notion of "every session but this one" — a refresh-token
   * family is revoked wholesale — so the caller has to sign out afterwards
   * rather than tell the operator they are still safely signed in here.
   */
  logoutAll: () => api.post<{ revokedSessions: number }>("/auth/logout-all"),

  setupTwoFactor: () => api.post<{ secret: string; otpauthUrl: string }>("/auth/two-factor/setup"),

  confirmTwoFactor: (code: string) => api.post<{ enabled: true }>("/auth/two-factor/confirm", { code }),

  devices: () => api.get<AuthDevice[]>("/auth/devices"),

  /** Releases one bound device. It has to sign in again to be re-bound. */
  unbindDevice: (id: string) => api.delete<{ unbound: true }>(`/auth/devices/${id}`),
};
