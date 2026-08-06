import { api, setTokens, deviceId, type ApiResult } from "../client";
import type { Role } from "@/shared/constants/roles";

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

  setupTwoFactor: () => api.post<{ secret: string; otpauthUrl: string }>("/auth/two-factor/setup"),

  confirmTwoFactor: (code: string) => api.post<{ enabled: true }>("/auth/two-factor/confirm", { code }),

  devices: () => api.get("/auth/devices"),
};
