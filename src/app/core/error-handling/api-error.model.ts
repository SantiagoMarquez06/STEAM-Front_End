export interface ApiErrorResponse {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  validations?: Record<string, string>;
}

export interface AppErrorMessage {
  title: string;
  message: string;
  status?: number;
  path?: string;
  validations?: Record<string, string>;
}
