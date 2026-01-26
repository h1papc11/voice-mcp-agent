/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $VoiceProfileResponse = {
  description: `Response model for voice profile.`,
  properties: {
    id: {
      type: 'string',
      isRequired: true,
    },
    name: {
      type: 'string',
      isRequired: true,
    },
    description: {
      type: 'any-of',
      contains: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      isRequired: true,
    },
    language: {
      type: 'string',
      isRequired: true,
    },
    created_at: {
      type: 'string',
      isRequired: true,
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      isRequired: true,
      format: 'date-time',
    },
  },
} as const;
