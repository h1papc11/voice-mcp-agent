/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Response model for history entry (includes profile name).
 */
export type HistoryResponse = {
  id: string;
  profile_id: string;
  profile_name: string;
  text: string;
  language: string;
  audio_path: string;
  duration: number;
  seed: number | null;
  instruct: string | null;
  created_at: string;
};
