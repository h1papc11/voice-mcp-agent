/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $VoiceProfileCreate = {
  description: `Request model for creating a voice profile.`,
  properties: {
    name: {
      type: 'string',
      isRequired: true,
      maxLength: 100,
      minLength: 1,
    },
    description: {
      type: 'any-of',
      contains: [
        {
          type: 'string',
          maxLength: 500,
        },
        {
          type: 'null',
        },
      ],
    },
    language: {
      type: 'string',
      pattern: '^(en|zh)$',
    },
  },
} as const;
