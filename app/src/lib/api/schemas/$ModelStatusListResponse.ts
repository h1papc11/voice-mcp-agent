/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ModelStatusListResponse = {
  description: `Response model for model status list.`,
  properties: {
    models: {
      type: 'array',
      contains: {
        type: 'ModelStatus',
      },
      isRequired: true,
    },
  },
} as const;
