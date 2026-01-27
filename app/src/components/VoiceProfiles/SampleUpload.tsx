import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect, useRef } from 'react';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAddSample, useProfile } from '@/lib/hooks/useProfiles';
import { useTranscription } from '@/lib/hooks/useTranscription';
import { useAudioRecording } from '@/lib/hooks/useAudioRecording';
import { useSystemAudioCapture } from '@/lib/hooks/useSystemAudioCapture';
import { Mic, Square, Upload, Monitor, Play, Pause } from 'lucide-react';
import { formatAudioDuration } from '@/lib/utils/audio';
import { isTauri } from '@/lib/tauri';

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
  const [mode, setMode] = useState<'upload' | 'record' | 'system'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    onRecordingComplete: (blob, recordedDuration) => {
      // Convert blob to File object
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: blob.type || 'audio/webm',
      }) as File & { recordedDuration?: number };
      // Store the actual recorded duration to bypass metadata reading issues on Windows
      if (recordedDuration !== undefined) {
        file.recordedDuration = recordedDuration;
      }
      form.setValue('file', file, { shouldValidate: true });
      toast({
        title: 'Recording complete',
        description: 'Audio has been recorded successfully.',
      });
    },
  });

  const {
    isRecording: isSystemRecording,
    duration: systemDuration,
    error: systemRecordingError,
    isSupported: isSystemAudioSupported,
    startRecording: startSystemRecording,
    stopRecording: stopSystemRecording,
    cancelRecording: cancelSystemRecording,
  } = useSystemAudioCapture({
    maxDurationSeconds: 30,
    onRecordingComplete: (blob, recordedDuration) => {
      // Convert blob to File object
      const file = new File([blob], `system-audio-${Date.now()}.wav`, {
        type: blob.type || 'audio/wav',
      }) as File & { recordedDuration?: number };
      // Store the actual recorded duration to bypass metadata reading issues on Windows
      if (recordedDuration !== undefined) {
        file.recordedDuration = recordedDuration;
      }
      form.setValue('file', file, { shouldValidate: true });
      toast({
        title: 'System audio captured',
        description: 'Audio has been captured successfully.',
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

  // Show system audio recording errors
  useEffect(() => {
    if (systemRecordingError) {
      toast({
        title: 'System audio capture error',
        description: systemRecordingError,
        variant: 'destructive',
      });
    }
  }, [systemRecordingError, toast]);

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
      if (isSystemRecording) {
        cancelSystemRecording();
      }
      // Stop and cleanup audio
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current = null;
      }
      setIsPlaying(false);
    }
    onOpenChange(newOpen);
  }

  function handleCancelRecording() {
    if (mode === 'record') {
      cancelRecording();
    } else if (mode === 'system') {
      cancelSystemRecording();
    }
    // Reset file field by clearing the input
    form.resetField('file');
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }

  function handlePlayPause() {
    const file = form.getValues('file');
    if (!file) return;

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio(URL.createObjectURL(file));
      audioRef.current = audio;
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        if (audioRef.current) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      });

      audio.addEventListener('error', () => {
        setIsPlaying(false);
        toast({
          title: 'Playback error',
          description: 'Failed to play audio file',
          variant: 'destructive',
        });
        if (audioRef.current) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      });

      audio.play();
      setIsPlaying(true);
    }
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
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as 'upload' | 'record' | 'system')}
            >
              <TabsList
                className={`grid w-full ${isTauri() && isSystemAudioSupported ? 'grid-cols-3' : 'grid-cols-2'}`}
              >
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4 shrink-0" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="record" className="flex items-center gap-2">
                  <Mic className="h-4 w-4 shrink-0" />
                  Record
                </TabsTrigger>
                {isTauri() && isSystemAudioSupported && (
                  <TabsTrigger value="system" className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 shrink-0" />
                    System Audio
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, name } }) => (
                    <FormItem>
                      <FormLabel>Audio File</FormLabel>
                      <FormControl>
                        <div className="flex flex-col gap-2">
                          <input
                            type="file"
                            accept="audio/*"
                            name={name}
                            ref={fileInputRef}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                onChange(file);
                              }
                            }}
                            className="hidden"
                          />
                          <div
                            role="button"
                            tabIndex={0}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file && file.type.startsWith('audio/')) {
                                onChange(file);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                fileInputRef.current?.click();
                              }
                            }}
                            className={`flex flex-col items-center justify-center gap-4 p-4 border-2 rounded-lg transition-colors min-h-[180px] ${
                              selectedFile
                                ? 'border-primary bg-primary/5'
                                : isDragging
                                  ? 'border-primary bg-primary/5'
                                  : 'border-dashed border-muted-foreground/25 hover:border-muted-foreground/50'
                            }`}
                          >
                            {!selectedFile ? (
                              <>
                                <Button
                                  type="button"
                                  size="lg"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="flex items-center gap-2"
                                >
                                  <Upload className="h-5 w-5" />
                                  Choose File
                                </Button>
                                <p className="text-sm text-muted-foreground text-center">
                                  Click to choose a file or drag and drop. Maximum duration: 30 seconds.
                                </p>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <Upload className="h-5 w-5 text-primary" />
                                  <span className="font-medium">File uploaded</span>
                                </div>
                                <p className="text-sm text-muted-foreground text-center">
                                  File: {selectedFile.name}
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    onClick={handlePlayPause}
                                  >
                                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                  </Button>
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
                                    onClick={() => {
                                      onChange(undefined);
                                      if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                      }
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </FormControl>
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
                            <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-dashed rounded-lg min-h-[180px]">
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
                            <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-destructive rounded-lg bg-destructive/5 min-h-[180px]">
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
                                {formatAudioDuration(30 - duration)} remaining
                              </p>
                            </div>
                          )}

                          {selectedFile && !isRecording && (
                            <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-primary rounded-lg bg-primary/5 min-h-[180px]">
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
                                  size="icon"
                                  variant="outline"
                                  onClick={handlePlayPause}
                                >
                                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </Button>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {isTauri() && isSystemAudioSupported && (
                <TabsContent value="system" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="file"
                    render={() => (
                      <FormItem>
                        <FormLabel>Capture System Audio</FormLabel>
                        <FormControl>
                          <div className="space-y-4">
                            {!isSystemRecording && !selectedFile && (
                              <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-dashed rounded-lg min-h-[180px]">
                                <Button
                                  type="button"
                                  onClick={startSystemRecording}
                                  size="lg"
                                  className="flex items-center gap-2"
                                >
                                  <Monitor className="h-5 w-5" />
                                  Start Capture
                                </Button>
                                <p className="text-sm text-muted-foreground text-center">
                                  Capture audio from your system. Maximum duration: 30 seconds.
                                </p>
                              </div>
                            )}

                            {isSystemRecording && (
                              <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-destructive rounded-lg bg-destructive/5 min-h-[180px]">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                                    <span className="text-lg font-mono font-semibold">
                                      {formatAudioDuration(systemDuration)}
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  onClick={stopSystemRecording}
                                  variant="destructive"
                                  className="flex items-center gap-2"
                                >
                                  <Square className="h-4 w-4" />
                                  Stop Capture
                                </Button>
                                <p className="text-sm text-muted-foreground text-center">
                                  {formatAudioDuration(30 - systemDuration)} remaining
                                </p>
                              </div>
                            )}

                            {selectedFile && !isSystemRecording && mode === 'system' && (
                              <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-primary rounded-lg bg-primary/5 min-h-[180px]">
                                <div className="flex items-center gap-2">
                                  <Monitor className="h-5 w-5 text-primary" />
                                  <span className="font-medium">Capture complete</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  File: {selectedFile.name}
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    onClick={handlePlayPause}
                                  >
                                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                  </Button>
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
                                    Capture Again
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              )}
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
