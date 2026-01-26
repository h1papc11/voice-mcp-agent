/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Body_transcribe_audio_transcribe_post = {
  properties: {
    file: {
      type: 'binary',
      isRequired: true,
      format: 'binary',
    },
    language: {
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
  },
} as const;
