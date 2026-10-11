export interface ApiSuccess<T> {
  code: 'OK';
  message: string;
  data: T;
}

export interface ApiFailure {
  code: string;
  message: string;
  data: null;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuthMe {
  authenticated: boolean;
  user: import('./domain').SessionUser | null;
}
