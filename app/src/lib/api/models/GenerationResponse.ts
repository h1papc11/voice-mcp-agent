/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Response model for voice generation.
 */
export type GenerationResponse = {
  id: string;
  profile_id: string;
  text: string;
  language: string;
  audio_path: string;
  duration: number;
  seed: number | null;
  instruct: string | null;
  created_at: string;
};
