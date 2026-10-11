import type { SessionUser } from '@/types/domain';

export interface AppBindings {
  Bindings: Env;
  Variables: {
    user: SessionUser | null;
  };
}

export interface ErrorPayload {
  code: string;
  message: string;
  data: null;
  details?: unknown;
}
