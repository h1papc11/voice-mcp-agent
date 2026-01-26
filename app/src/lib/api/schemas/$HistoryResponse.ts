/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $HistoryResponse = {
  description: `Response model for history entry (includes profile name).`,
  properties: {
    id: {
      type: 'string',
      isRequired: true,
    },
    profile_id: {
      type: 'string',
      isRequired: true,
    },
    profile_name: {
      type: 'string',
      isRequired: true,
    },
    text: {
      type: 'string',
      isRequired: true,
    },
    language: {
      type: 'string',
      isRequired: true,
    },
    audio_path: {
      type: 'string',
      isRequired: true,
    },
    duration: {
      type: 'number',
      isRequired: true,
    },
    seed: {
      type: 'any-of',
      contains: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      isRequired: true,
    },
    created_at: {
      type: 'string',
      isRequired: true,
      format: 'date-time',
    },
  },
} as const;
