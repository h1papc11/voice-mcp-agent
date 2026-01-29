import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { LanguageCode } from '@/lib/constants/languages';

export function useTranscription() {
  return useMutation({
    mutationFn: ({ file, language }: { file: File; language?: LanguageCode }) =>
      apiClient.transcribeAudio(file, language),
  });
}
