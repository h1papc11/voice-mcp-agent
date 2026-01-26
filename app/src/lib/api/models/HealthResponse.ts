/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Response model for health check.
 */
export type HealthResponse = {
  status: string;
  model_loaded: boolean;
  model_downloaded?: boolean | null;
  model_size?: string | null;
  gpu_available: boolean;
  vram_used_mb?: number | null;
};
