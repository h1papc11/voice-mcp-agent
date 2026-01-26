import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAddSample, useProfile } from '@/lib/hooks/useProfiles';
import { useTranscription } from '@/lib/hooks/useTranscription';
import { useAudioRecording } from '@/lib/hooks/useAudioRecording';
import { Mic, Square, Upload } from 'lucide-react';
import { formatAudioDuration } from '@/lib/utils/audio';

const sampleSchema = z.object({
  file: z.instanceof(File, { message: 'Please select an audio file' }),
  referenceText: z
    .string()
    .min(1, 'Reference text is required')
    .max(1000, 'Reference text must be less than 1000 characters'),
});

type SampleFormValues = z.infer<typeof sampleSchema>;

interface SampleUploadProps {
  profileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SampleUpload({ profileId, open, onOpenChange }: SampleUploadProps) {
  const addSample = useAddSample();
  const transcribe = useTranscription();
  const { data: profile } = useProfile(profileId);
  const { toast } = useToast();
  const [mode, setMode] = useState<'upload' | 'record'>('upload');

  const form = useForm<SampleFormValues>({
    resolver: zodResolver(sampleSchema),
    defaultValues: {
      referenceText: '',
    },
  });

  const selectedFile = form.watch('file');

  const {
    isRecording,
    duration,
    error: recordingError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecording({
    maxDurationSeconds: 30,
    onRecordingComplete: (blob) => {
      // Convert blob to File object
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: blob.type || 'audio/webm',
      });
      form.setValue('file', file, { shouldValidate: true });
      toast({
        title: 'Recording complete',
        description: 'Audio has been recorded successfully.',
      });
    },
  });

  // Show recording errors
  useEffect(() => {
    if (recordingError) {
      toast({
        title: 'Recording error',
        description: recordingError,
        variant: 'destructive',
      });
    }
  }, [recordingError, toast]);

  async function handleTranscribe() {
    const file = form.getValues('file');
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select an audio file first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const language = profile?.language as 'en' | 'zh' | undefined;
      const result = await transcribe.mutateAsync({ file, language });

      form.setValue('referenceText', result.text, { shouldValidate: true });

      toast({
        title: 'Transcription complete',
        description: 'Audio has been transcribed successfully.',
      });
    } catch (error) {
      toast({
        title: 'Transcription failed',
        description: error instanceof Error ? error.message : 'Failed to transcribe audio',
        variant: 'destructive',
      });
    }
  }

  async function onSubmit(data: SampleFormValues) {
    try {
      await addSample.mutateAsync({
        profileId,
        file: data.file,
        referenceText: data.referenceText,
      });

      toast({
        title: 'Sample added',
        description: 'Audio sample has been added successfully.',
      });

      handleOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add sample',
        variant: 'destructive',
      });
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      form.reset();
      setMode('upload');
      if (isRecording) {
        cancelRecording();
      }
    }
    onOpenChange(newOpen);
  }

  function handleCancelRecording() {
    cancelRecording();
    // Reset file field by clearing the input
    form.resetField('file');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Audio Sample</DialogTitle>
          <DialogDescription>
            Upload an audio file and provide the reference text that matches the audio.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'upload' | 'record')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="record" className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Record
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      <FormLabel>Audio File</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                onChange(file);
                              }
                            }}
                            {...field}
                          />
                          {selectedFile && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleTranscribe}
                              disabled={transcribe.isPending}
                              className="flex items-center gap-2"
                            >
                              <Mic className="h-4 w-4" />
                              {transcribe.isPending ? 'Transcribing...' : 'Transcribe'}
                            </Button>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Supported formats: WAV, MP3, M4A. Click "Transcribe" to automatically
                        extract text from the audio.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="record" className="space-y-4">
                <FormField
                  control={form.control}
                  name="file"
                  render={() => (
                    <FormItem>
                      <FormLabel>Record Audio</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          {!isRecording && !selectedFile && (
                            <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg">
                              <Button
                                type="button"
                                onClick={startRecording}
                                size="lg"
                                className="flex items-center gap-2"
                              >
                                <Mic className="h-5 w-5" />
                                Start Recording
                              </Button>
                              <p className="text-sm text-muted-foreground text-center">
                                Click to start recording. Maximum duration: 30 seconds.
                              </p>
                            </div>
                          )}

                          {isRecording && (
                            <div className="flex flex-col items-center gap-4 p-6 border-2 border-destructive rounded-lg bg-destructive/5">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                                  <span className="text-lg font-mono font-semibold">
                                    {formatAudioDuration(duration)}
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                onClick={stopRecording}
                                variant="destructive"
                                className="flex items-center gap-2"
                              >
                                <Square className="h-4 w-4" />
                                Stop Recording
                              </Button>
                              <p className="text-sm text-muted-foreground text-center">
                                Recording in progress... ({formatAudioDuration(30 - duration)}{' '}
                                remaining)
                              </p>
                            </div>
                          )}

                          {selectedFile && !isRecording && (
                            <div className="flex flex-col items-center gap-4 p-6 border-2 border-primary rounded-lg bg-primary/5">
                              <div className="flex items-center gap-2">
                                <Mic className="h-5 w-5 text-primary" />
                                <span className="font-medium">Recording complete</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                File: {selectedFile.name}
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleTranscribe}
                                  disabled={transcribe.isPending}
                                  className="flex items-center gap-2"
                                >
                                  <Mic className="h-4 w-4" />
                                  {transcribe.isPending ? 'Transcribing...' : 'Transcribe'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleCancelRecording}
                                  className="flex items-center gap-2"
                                >
                                  Record Again
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Record audio directly from your microphone. Maximum duration is 30 seconds.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <FormField
              control={form.control}
              name="referenceText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Text</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the exact text spoken in the audio..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This should match exactly what is spoken in the audio file.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addSample.isPending}>
                {addSample.isPending ? 'Uploading...' : 'Add Sample'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
