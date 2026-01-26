import { zodResolver } from '@hookform/resolvers/zod';
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
  FormDescription,
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  useCreateProfile,
  useProfile,
  useUpdateProfile,
  useAddSample,
} from '@/lib/hooks/useProfiles';
import { useTranscription } from '@/lib/hooks/useTranscription';
import { useAudioRecording } from '@/lib/hooks/useAudioRecording';
import { useUIStore } from '@/stores/uiStore';
import { Mic, Square, Upload } from 'lucide-react';
import { formatAudioDuration } from '@/lib/utils/audio';

// Helper function to get audio duration from File
async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });
    
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio file'));
    });
    
    audio.src = url;
  });
}

const MAX_AUDIO_DURATION_SECONDS = 30;

const profileSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().max(500).optional(),
    language: z.enum(['en', 'zh']),
    // Sample fields - only required when creating (not editing)
    sampleFile: z.instanceof(File).optional(),
    referenceText: z.string().max(1000).optional(),
  })
  .refine(
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
  const [sampleMode, setSampleMode] = useState<'upload' | 'record'>('upload');
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [isValidatingAudio, setIsValidatingAudio] = useState(false);
  const isCreating = !editingProfileId;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      description: '',
      language: 'en',
    },
  });

  const selectedFile = form.watch('sampleFile');

  // Validate audio duration when file is selected
  useEffect(() => {
    if (selectedFile && selectedFile instanceof File) {
      setIsValidatingAudio(true);
      getAudioDuration(selectedFile)
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
          form.setError('sampleFile', {
            type: 'manual',
            message: 'Failed to validate audio file. Please try a different file.',
          });
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
    onRecordingComplete: (blob) => {
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: blob.type || 'audio/webm',
      });
      form.setValue('sampleFile', file, { shouldValidate: true });
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

  useEffect(() => {
    if (editingProfile) {
      form.reset({
        name: editingProfile.name,
        description: editingProfile.description || '',
        language: editingProfile.language as 'en' | 'zh',
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
      const language = form.getValues('language') as 'en' | 'zh' | undefined;
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

  function handleCancelRecording() {
    cancelRecording();
    form.resetField('sampleFile');
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
          title: 'Profile updated',
          description: `"${data.name}" has been updated successfully.`,
        });
      } else {
        // Get file and reference text directly from form state to ensure we have the values
        const sampleFile = form.getValues('sampleFile');
        const referenceText = form.getValues('referenceText');

        // Validate audio duration before creating profile
        if (sampleFile) {
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
        }

        // Creating: create profile, then optionally add sample
        const profile = await createProfile.mutateAsync({
          name: data.name,
          description: data.description,
          language: data.language,
        });

        // If sample file and reference text provided, add it
        if (sampleFile && referenceText && referenceText.trim().length > 0) {
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
            // Profile was created but sample failed - still show success for profile
            toast({
              title: 'Profile created',
              description: `"${data.name}" has been created, but failed to add sample: ${sampleError instanceof Error ? sampleError.message : 'Unknown error'}`,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Profile created',
            description: `"${data.name}" has been created successfully. You can add samples later.`,
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
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{editingProfileId ? 'Edit Profile' : 'Create Voice Profile'}</DialogTitle>
          <DialogDescription>
            {editingProfileId
              ? 'Update your voice profile details.'
              : 'Create a new voice profile. You can add a sample now or later.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className={`grid gap-6 ${isCreating ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right column: Sample upload section - only show when creating */}
              {isCreating && (
                <div className="space-y-4 border-l pl-6">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Add Sample (Optional)</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add an audio sample to get started immediately. You can add more samples
                      later.
                    </p>
                  </div>

                  <Tabs
                    value={sampleMode}
                    onValueChange={(v) => setSampleMode(v as 'upload' | 'record')}
                  >
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
                        name="sampleFile"
                        render={({ field: { onChange, name, ref } }) => (
                          <FormItem>
                            <FormLabel>Audio File</FormLabel>
                            <FormControl>
                              <div className="flex flex-col gap-2">
                                <Input
                                  type="file"
                                  accept="audio/*"
                                  name={name}
                                  ref={ref}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      onChange(file);
                                    } else {
                                      onChange(undefined);
                                    }
                                  }}
                                />
                                {selectedFile && (
                                  <>
                                    {isValidatingAudio && (
                                      <p className="text-sm text-muted-foreground">
                                        Validating audio...
                                      </p>
                                    )}
                                    {!isValidatingAudio && audioDuration !== null && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">Duration:</span>
                                        <span
                                          className={
                                            audioDuration > MAX_AUDIO_DURATION_SECONDS
                                              ? 'text-destructive font-medium'
                                              : 'text-foreground'
                                          }
                                        >
                                          {formatAudioDuration(audioDuration)}
                                        </span>
                                        <span className="text-muted-foreground">
                                          / {formatAudioDuration(MAX_AUDIO_DURATION_SECONDS)} max
                                        </span>
                                      </div>
                                    )}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={handleTranscribe}
                                      disabled={transcribe.isPending || isValidatingAudio || (audioDuration !== null && audioDuration > MAX_AUDIO_DURATION_SECONDS)}
                                      className="flex items-center gap-2 w-full"
                                    >
                                      <Mic className="h-4 w-4" />
                                      {transcribe.isPending ? 'Transcribing...' : 'Transcribe'}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </FormControl>
                            <FormDescription>
                              Supported formats: WAV, MP3, M4A. Maximum duration:{' '}
                              {formatAudioDuration(MAX_AUDIO_DURATION_SECONDS)}. Click "Transcribe"
                              to automatically extract text from the audio.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="record" className="space-y-4">
                      <FormField
                        control={form.control}
                        name="sampleFile"
                        render={() => (
                          <FormItem>
                            <FormLabel>Record Audio</FormLabel>
                            <FormControl>
                              <div className="space-y-4">
                                {!isRecording && !selectedFile && (
                                  <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed rounded-lg">
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
                                  <div className="flex flex-col items-center gap-4 p-4 border-2 border-destructive rounded-lg bg-destructive/5">
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
                                  <div className="flex flex-col items-center gap-4 p-4 border-2 border-primary rounded-lg bg-primary/5">
                                    <div className="flex items-center gap-2">
                                      <Mic className="h-5 w-5 text-primary" />
                                      <span className="font-medium">Recording complete</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground text-center">
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
                              Record audio directly from your microphone. Maximum duration is 30
                              seconds.
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
                          This should match exactly what is spoken in the audio file. Required if
                          you add a sample.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
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
                    ? 'Update Profile'
                    : 'Create Profile'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
