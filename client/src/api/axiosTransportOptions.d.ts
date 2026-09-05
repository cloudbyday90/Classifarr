/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import 'axios';

declare module 'axios' {
  interface AxiosRequestConfig<D = any, P = any> {
    /** Return failures to the caller without network retries or authentication replay. */
    skipAutomaticRetry?: boolean;
  }
}
