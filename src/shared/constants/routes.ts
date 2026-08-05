export const ROUTES = {
  home: "/",
  login: "/login",
  forgotPassword: "/forgot-password",
  twoFactor: "/two-factor",

  dashboard: "/dashboard",

  zones: "/zones",
  zone: (id: string) => `/zones/${id}`,
  slots: "/slots",

  sessions: "/sessions",
  session: (id: string) => `/sessions/${id}`,
  incidents: "/incidents",

  vendors: "/vendors",
  vendor: (id: string) => `/vendors/${id}`,
  attendants: "/attendants",
  shifts: "/shifts",

  tariffs: "/tariffs",
  passes: "/passes",

  payments: "/payments",
  settlements: "/settlements",
  settlement: (id: string) => `/settlements/${id}`,
  revenue: "/revenue",
  reports: "/reports",

  citizens: "/citizens",
  audit: "/audit",
  cms: "/cms",
  settings: "/settings",
} as const;

export const API = {
  base: "/api/v1",
} as const;
