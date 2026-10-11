import type { ApiFailure, ApiResponse, ApiSuccess } from '@/types/api';

export function ok<T>(data: T, message = 'ok'): ApiSuccess<T> {
  return { code: 'OK', message, data };
}

export function fail(code: string, message: string, details?: unknown): ApiFailure {
  return { code, message, data: null, details };
}

export async function parseApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  return payload;
}
