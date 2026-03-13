import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import { usePlatform } from '@/platform/PlatformContext';
import { useServerStore } from '@/stores/serverStore';

const connectionSchema = z.object({
  serverUrl: z.string().url('Please enter a valid URL'),
});

type ConnectionFormValues = z.infer<typeof connectionSchema>;

export function ConnectionForm() {
  const platform = usePlatform();
  const serverUrl = useServerStore((state) => state.serverUrl);
  const setServerUrl = useServerStore((state) => state.setServerUrl);
  const keepServerRunningOnClose = useServerStore((state) => state.keepServerRunningOnClose);
  const setKeepServerRunningOnClose = useServerStore((state) => state.setKeepServerRunningOnClose);
  const mode = useServerStore((state) => state.mode);
  const setMode = useServerStore((state) => state.setMode);
  const maxChunkChars = useServerStore((state) => state.maxChunkChars);
  const setMaxChunkChars = useServerStore((state) => state.setMaxChunkChars);
  const crossfadeMs = useServerStore((state) => state.crossfadeMs);
  const setCrossfadeMs = useServerStore((state) => state.setCrossfadeMs);
  const { toast } = useToast();

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      serverUrl: serverUrl,
    },
  });

  // Sync form with store when serverUrl changes externally
  useEffect(() => {
    form.reset({ serverUrl });
  }, [serverUrl, form]);

  const { isDirty } = form.formState;

  function onSubmit(data: ConnectionFormValues) {
    setServerUrl(data.serverUrl);
    form.reset(data); // Reset form state after successful submission
    toast({
      title: 'Server URL updated',
      description: `Connected to ${data.serverUrl}`,
    });
  }

  return (
    <Card role="region" aria-label="Server Connection" tabIndex={0}>
      <CardHeader>
        <CardTitle>Server Connection</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="serverUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server URL</FormLabel>
                  <FormControl>
                    <Input placeholder="http://127.0.0.1:17493" {...field} />
                  </FormControl>
                  <FormDescription>Enter the URL of your voicebox backend server</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isDirty && <Button type="submit">Update Connection</Button>}
          </form>
        </Form>

        <div className="mt-6 pt-6 border-t">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="keepServerRunning"
              checked={keepServerRunningOnClose}
              onCheckedChange={(checked: boolean) => {
                setKeepServerRunningOnClose(checked);
                platform.lifecycle.setKeepServerRunning(checked).catch((error) => {
                  console.error('Failed to sync setting to Rust:', error);
                });
                toast({
                  title: 'Setting updated',
                  description: checked
                    ? 'Server will continue running when app closes'
                    : 'Server will stop when app closes',
                });
              }}
            />
            <div className="space-y-1">
              <label
                htmlFor="keepServerRunning"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Keep server running when app closes
              </label>
              <p className="text-sm text-muted-foreground">
                When enabled, the server will continue running in the background after closing the
                app. Disabled by default.
              </p>
            </div>
          </div>
        </div>

        {platform.metadata.isTauri && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="allowNetworkAccess"
                checked={mode === 'remote'}
                onCheckedChange={(checked: boolean) => {
                  setMode(checked ? 'remote' : 'local');
                  toast({
                    title: 'Setting updated',
                    description: checked
                      ? 'Network access enabled. Restart the app to apply.'
                      : 'Network access disabled. Restart the app to apply.',
                  });
                }}
              />
              <div className="space-y-1">
                <label
                  htmlFor="allowNetworkAccess"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Allow network access
                </label>
                <p className="text-sm text-muted-foreground">
                  Makes the server accessible from other devices on your network. Restart the app
                  after changing this setting.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="maxChunkChars" className="text-sm font-medium leading-none">
                Auto-chunking limit
              </label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {maxChunkChars} chars
              </span>
            </div>
            <Slider
              id="maxChunkChars"
              value={[maxChunkChars]}
              onValueChange={([value]) => setMaxChunkChars(value)}
              min={100}
              max={2000}
              step={50}
              aria-label="Auto-chunking character limit"
            />
            <p className="text-sm text-muted-foreground">
              Long text is split into chunks at sentence boundaries before generating. Lower values
              can improve quality for long outputs. Default is 800.
            </p>
          </div>

          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <label htmlFor="crossfadeMs" className="text-sm font-medium leading-none">
                Chunk crossfade
              </label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {crossfadeMs === 0 ? 'Cut' : `${crossfadeMs}ms`}
              </span>
            </div>
            <Slider
              id="crossfadeMs"
              value={[crossfadeMs]}
              onValueChange={([value]) => setCrossfadeMs(value)}
              min={0}
              max={200}
              step={10}
              aria-label="Chunk crossfade duration"
            />
            <p className="text-sm text-muted-foreground">
              Blends audio between chunks to smooth transitions. Set to 0 for a hard cut.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
