import { zodResolver } from '@hookform/resolvers/zod';
import { Mic, Monitor, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { LANGUAGE_CODES, LANGUAGE_OPTIONS, type LanguageCode } from '@/lib/constants/languages';
import { useAudioPlayer } from '@/lib/hooks/useAudioPlayer';
import { useAudioRecording } from '@/lib/hooks/useAudioRecording';
import {
  useAddSample,
  useCreateProfile,
  useProfile,
  useUpdateProfile,
} from '@/lib/hooks/useProfiles';
import { useSystemAudioCapture } from '@/lib/hooks/useSystemAudioCapture';
import { useTranscription } from '@/lib/hooks/useTranscription';
import { isTauri } from '@/lib/tauri';
import { formatAudioDuration } from '@/lib/utils/audio';
import { useUIStore } from '@/stores/uiStore';
import { AudioSampleRecording } from './AudioSampleRecording';
import { AudioSampleSystem } from './AudioSampleSystem';
import { AudioSampleUpload } from './AudioSampleUpload';
import { SampleList } from './SampleList';

// Helper function to get audio duration from File
async function getAudioDuration(file: File & { recordedDuration?: number }): Promise<number> {
  // If the file has a recordedDuration property (from our recording hooks),
  // use that instead of trying to read metadata. This fixes issues on Windows
  // where WebM files from MediaRecorder don't have proper duration metadata.
  if (file.recordedDuration !== undefined && Number.isFinite(file.recordedDuration)) {
    return file.recordedDuration;
  }

  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      // Check if duration is valid (not Infinity or NaN)
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        resolve(audio.duration);
      } else {
        reject(new Error('Audio file has invalid duration metadata'));
      }
    });

    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio file'));
    });

    audio.src = url;
  });
}

const MAX_AUDIO_DURATION_SECONDS = 30;

const baseProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  language: z.enum(LANGUAGE_CODES as [LanguageCode, ...LanguageCode[]]),
  sampleFile: z.instanceof(File).optional(),
  referenceText: z.string().max(1000).optional(),
});

const profileSchema = baseProfileSchema.refine(
  (data) => {
    // If sample file is provided, reference text is required
    if (data.sampleFile && (!data.referenceText || data.referenceText.trim().length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'Reference text is required when adding a sample',
    path: ['referenceText'],
  },
);

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm() {
  const open = useUIStore((state) => state.profileDialogOpen);
  const setOpen = useUIStore((state) => state.setProfileDialogOpen);
  const editingProfileId = useUIStore((state) => state.editingProfileId);
  const setEditingProfileId = useUIStore((state) => state.setEditingProfileId);
  const { data: editingProfile } = useProfile(editingProfileId || '');
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const addSample = useAddSample();
  const transcribe = useTranscription();
  const { toast } = useToast();
  const [sampleMode, setSampleMode] = useState<'upload' | 'record' | 'system'>('upload');
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [isValidatingAudio, setIsValidatingAudio] = useState(false);
  const { isPlaying, playPause, cleanup: cleanupAudio } = useAudioPlayer();
  const isCreating = !editingProfileId;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      description: '',
      language: 'en',
      sampleFile: undefined,
      referenceText: '',
    },
  });

  const selectedFile = form.watch('sampleFile');

  // Validate audio duration when file is selected
  useEffect(() => {
    if (selectedFile && selectedFile instanceof File) {
      setIsValidatingAudio(true);
      getAudioDuration(selectedFile as File & { recordedDuration?: number })
        .then((duration) => {
          setAudioDuration(duration);
          if (duration > MAX_AUDIO_DURATION_SECONDS) {
            form.setError('sampleFile', {
              type: 'manual',
              message: `Audio is too long (${formatAudioDuration(duration)}). Maximum duration is ${formatAudioDuration(MAX_AUDIO_DURATION_SECONDS)}.`,
            });
          } else {
            form.clearErrors('sampleFile');
          }
        })
        .catch((error) => {
          console.error('Failed to get audio duration:', error);
          setAudioDuration(null);
          // For recordings, we auto-stop at max duration, so we can skip validation errors
          const isRecordedFile =
            selectedFile.name.startsWith('recording-') ||
            selectedFile.name.startsWith('system-audio-');
          if (!isRecordedFile) {
            form.setError('sampleFile', {
              type: 'manual',
              message: 'Failed to validate audio file. Please try a different file.',
            });
          } else {
            // Clear any existing errors for recorded files
            form.clearErrors('sampleFile');
          }
        })
        .finally(() => {
          setIsValidatingAudio(false);
        });
    } else {
      setAudioDuration(null);
      form.clearErrors('sampleFile');
    }
  }, [selectedFile, form]);

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
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: blob.type || 'audio/webm',
      }) as File & { recordedDuration?: number };
      // Store the actual recorded duration to bypass metadata reading issues on Windows
      if (recordedDuration !== undefined) {
        file.recordedDuration = recordedDuration;
      }
      form.setValue('sampleFile', file, { shouldValidate: true });
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
      const file = new File([blob], `system-audio-${Date.now()}.wav`, {
        type: blob.type || 'audio/wav',
      }) as File & { recordedDuration?: number };
      // Store the actual recorded duration to bypass metadata reading issues on Windows
      if (recordedDuration !== undefined) {
        file.recordedDuration = recordedDuration;
      }
      form.setValue('sampleFile', file, { shouldValidate: true });
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

  useEffect(() => {
    if (editingProfile) {
      form.reset({
        name: editingProfile.name,
        description: editingProfile.description || '',
        language: editingProfile.language as LanguageCode,
        sampleFile: undefined,
        referenceText: undefined,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        language: 'en',
        sampleFile: undefined,
        referenceText: undefined,
      });
      setSampleMode('upload');
    }
  }, [editingProfile, form]);

  async function handleTranscribe() {
    const file = form.getValues('sampleFile');
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select an audio file first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const language = form.getValues('language');
      const result = await transcribe.mutateAsync({ file, language });

      form.setValue('referenceText', result.text, { shouldValidate: true });
    } catch (error) {
      toast({
        title: 'Transcription failed',
        description: error instanceof Error ? error.message : 'Failed to transcribe audio',
        variant: 'destructive',
      });
    }
  }

  function handleCancelRecording() {
    if (sampleMode === 'record') {
      cancelRecording();
    } else if (sampleMode === 'system') {
      cancelSystemRecording();
    }
    form.resetField('sampleFile');
    cleanupAudio();
  }

  function handlePlayPause() {
    const file = form.getValues('sampleFile');
    playPause(file);
  }

  async function onSubmit(data: ProfileFormValues) {
    try {
      if (editingProfileId) {
        // Editing: just update profile
        await updateProfile.mutateAsync({
          profileId: editingProfileId,
          data: {
            name: data.name,
            description: data.description,
            language: data.language,
          },
        });
        toast({
          title: 'Voice updated',
          description: `"${data.name}" has been updated successfully.`,
        });
      } else {
        // Creating: require sample file and reference text
        const sampleFile = form.getValues('sampleFile');
        const referenceText = form.getValues('referenceText');

        if (!sampleFile) {
          form.setError('sampleFile', {
            type: 'manual',
            message: 'Audio sample is required',
          });
          toast({
            title: 'Audio sample required',
            description: 'Please provide an audio sample to create the voice profile.',
            variant: 'destructive',
          });
          return;
        }

        if (!referenceText || referenceText.trim().length === 0) {
          form.setError('referenceText', {
            type: 'manual',
            message: 'Reference text is required',
          });
          toast({
            title: 'Reference text required',
            description: 'Please provide the reference text for the audio sample.',
            variant: 'destructive',
          });
          return;
        }

        // Validate audio duration before creating profile
        try {
          const duration = await getAudioDuration(sampleFile);
          if (duration > MAX_AUDIO_DURATION_SECONDS) {
            form.setError('sampleFile', {
              type: 'manual',
              message: `Audio is too long (${formatAudioDuration(duration)}). Maximum duration is ${formatAudioDuration(MAX_AUDIO_DURATION_SECONDS)}.`,
            });
            toast({
              title: 'Invalid audio file',
              description: `Audio duration is ${formatAudioDuration(duration)}, but maximum is ${formatAudioDuration(MAX_AUDIO_DURATION_SECONDS)}.`,
              variant: 'destructive',
            });
            return; // Prevent form submission
          }
        } catch (error) {
          form.setError('sampleFile', {
            type: 'manual',
            message: 'Failed to validate audio file. Please try a different file.',
          });
          toast({
            title: 'Validation error',
            description: error instanceof Error ? error.message : 'Failed to validate audio file',
            variant: 'destructive',
          });
          return; // Prevent form submission
        }

        // Creating: create profile, then add sample
        const profile = await createProfile.mutateAsync({
          name: data.name,
          description: data.description,
          language: data.language,
        });

        try {
          await addSample.mutateAsync({
            profileId: profile.id,
            file: sampleFile,
            referenceText: referenceText,
          });
          toast({
            title: 'Profile created',
            description: `"${data.name}" has been created with a sample.`,
          });
        } catch (sampleError) {
          // Profile was created but sample failed - still show error
          toast({
            title: 'Failed to add sample',
            description: `Profile "${data.name}" was created, but failed to add sample: ${sampleError instanceof Error ? sampleError.message : 'Unknown error'}`,
            variant: 'destructive',
          });
        }
      }

      form.reset();
      setEditingProfileId(null);
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save profile',
        variant: 'destructive',
      });
    }
  }

  function handleOpenChange(open: boolean) {
    setOpen(open);
    if (!open) {
      setEditingProfileId(null);
      form.reset();
      setSampleMode('upload');
      if (isRecording) {
        cancelRecording();
      }
      if (isSystemRecording) {
        cancelSystemRecording();
      }
      cleanupAudio();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{editingProfileId ? 'Edit Voice' : 'Create Voice Profile'}</DialogTitle>
          <DialogDescription>
            {editingProfileId
              ? 'Update your voice profile details and manage samples.'
              : 'Create a new voice profile with an audio sample to clone the voice.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-6 grid-cols-2">
              {/* Left column: Profile info */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Voice" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe this voice..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {lang.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right column: Sample management */}
              <div className="space-y-4 border-l pl-6">
                {isCreating ? (
                  <>
                    <div>
                      <h3 className="text-sm font-medium mb-2">Add Sample</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Provide an audio sample to clone the voice. You can add more samples later.
                      </p>
                    </div>

                  <Tabs
                    value={sampleMode}
                    onValueChange={(v) => {
                      const newMode = v as 'upload' | 'record' | 'system';
                      // Cancel any active recordings when switching modes
                      if (isRecording && newMode !== 'record') {
                        cancelRecording();
                      }
                      if (isSystemRecording && newMode !== 'system') {
                        cancelSystemRecording();
                      }
                      setSampleMode(newMode);
                    }}
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
                        name="sampleFile"
                        render={({ field: { onChange, name } }) => (
                          <AudioSampleUpload
                            file={selectedFile}
                            onFileChange={onChange}
                            onTranscribe={handleTranscribe}
                            onPlayPause={handlePlayPause}
                            isPlaying={isPlaying}
                            isValidating={isValidatingAudio}
                            isTranscribing={transcribe.isPending}
                            isDisabled={
                              audioDuration !== null && audioDuration > MAX_AUDIO_DURATION_SECONDS
                            }
                            fieldName={name}
                          />
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="record" className="space-y-4">
                      <FormField
                        control={form.control}
                        name="sampleFile"
                        render={() => (
                          <AudioSampleRecording
                            file={selectedFile}
                            isRecording={isRecording}
                            duration={duration}
                            onStart={startRecording}
                            onStop={stopRecording}
                            onCancel={handleCancelRecording}
                            onTranscribe={handleTranscribe}
                            onPlayPause={handlePlayPause}
                            isPlaying={isPlaying}
                            isTranscribing={transcribe.isPending}
                          />
                        )}
                      />
                    </TabsContent>

                    {isTauri() && isSystemAudioSupported && (
                      <TabsContent value="system" className="space-y-4">
                        <FormField
                          control={form.control}
                          name="sampleFile"
                          render={() => (
                            <AudioSampleSystem
                              file={selectedFile}
                              isRecording={isSystemRecording}
                              duration={systemDuration}
                              onStart={startSystemRecording}
                              onStop={stopSystemRecording}
                              onCancel={handleCancelRecording}
                              onTranscribe={handleTranscribe}
                              onPlayPause={handlePlayPause}
                              isPlaying={isPlaying}
                              isTranscribing={transcribe.isPending}
                            />
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
                  </>
                ) : (
                  // Show sample list when editing
                  editingProfileId && (
                    <div>
                      <SampleList profileId={editingProfileId} />
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProfile.isPending || updateProfile.isPending || addSample.isPending}
              >
                {createProfile.isPending || updateProfile.isPending || addSample.isPending
                  ? 'Saving...'
                  : editingProfileId
                    ? 'Save Changes'
                    : 'Create Profile'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
