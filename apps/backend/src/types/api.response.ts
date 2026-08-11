export interface ApiResponseFormat<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
  timestamp: string;
}
