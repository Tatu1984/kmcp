export type Paise = number;

export interface ApiMeta {
  requestId: string;
  page?: number;
  pageSize?: number;
  total?: number;
  idempotentReplay?: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; issue: string }[];
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export type Trend = "up" | "down" | "flat";
