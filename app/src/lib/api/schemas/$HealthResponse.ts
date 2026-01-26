/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $HealthResponse = {
  description: `Response model for health check.`,
  properties: {
    status: {
      type: 'string',
      isRequired: true,
    },
    model_loaded: {
      type: 'boolean',
      isRequired: true,
    },
    model_downloaded: {
      type: 'any-of',
      contains: [
        {
          type: 'boolean',
        },
        {
          type: 'null',
        },
      ],
    },
    model_size: {
      type: 'any-of',
      contains: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    gpu_available: {
      type: 'boolean',
      isRequired: true,
    },
    vram_used_mb: {
      type: 'any-of',
      contains: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
  },
} as const;
