/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $HistoryListResponse = {
  description: `Response model for history list.`,
  properties: {
    items: {
      type: 'array',
      contains: {
        type: 'HistoryResponse',
      },
      isRequired: true,
    },
    total: {
      type: 'number',
      isRequired: true,
    },
  },
} as const;
