import { Edit, Plus, Trash2, Speaker } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { isTauri } from '@/lib/tauri';
import { invoke } from '@tauri-apps/api/core';

interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
}

export function AudioTab() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: () => apiClient.listChannels(),
  });

  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['audio-devices'],
    queryFn: async () => {
      if (!isTauri()) {
        return [];
      }
      try {
        const result = await invoke<AudioDevice[]>('list_audio_output_devices');
        return result;
      } catch (error) {
        console.error('Failed to list audio devices:', error);
        return [];
      }
    },
    enabled: isTauri(),
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => apiClient.listProfiles(),
  });

  const createChannel = useMutation({
    mutationFn: (data: { name: string; device_ids: string[] }) =>
      apiClient.createChannel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setCreateDialogOpen(false);
    },
  });

  const updateChannel = useMutation({
    mutationFn: ({
      channelId,
      data,
    }: {
      channelId: string;
      data: { name?: string; device_ids?: string[] };
    }) => apiClient.updateChannel(channelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['profile-channels'] });
      setEditingChannel(null);
    },
  });

  const deleteChannel = useMutation({
    mutationFn: (channelId: string) => apiClient.deleteChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['profile-channels'] });
    },
  });

  const { data: channelVoices } = useQuery({
    queryKey: ['channel-voices', editingChannel],
    queryFn: async () => {
      if (!editingChannel) return { profile_ids: [] };
      return apiClient.getChannelVoices(editingChannel);
    },
    enabled: !!editingChannel,
  });

  const setChannelVoices = useMutation({
    mutationFn: ({ channelId, profileIds }: { channelId: string; profileIds: string[] }) =>
      apiClient.setChannelVoices(channelId, profileIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-voices'] });
      queryClient.invalidateQueries({ queryKey: ['profile-channels'] });
    },
  });

  if (channelsLoading || devicesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Audio Channels</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Channel
        </Button>
      </div>

      <div className="flex-1 overflow-auto space-y-4">
        {channels?.map((channel) => (
          <Card key={channel.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Speaker className="h-5 w-5" />
                  {channel.name}
                  {channel.is_default && (
                    <span className="text-xs text-muted-foreground">(Default)</span>
                  )}
                </CardTitle>
                {!channel.is_default && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingChannel(channel.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this channel?')) {
                          deleteChannel.mutate(channel.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <Label className="text-sm font-medium">Output Devices:</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {channel.device_ids.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {channel.device_ids.map((deviceId) => {
                          const device = devices?.find((d) => d.id === deviceId);
                          return (
                            <li key={deviceId}>{device?.name || deviceId || 'Default Speakers'}</li>
                          );
                        })}
                      </ul>
                    ) : (
                      <span>Default Speakers</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Assigned Voices:</Label>
                  <ChannelVoicesList channelId={channel.id} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t">
        <h2 className="text-lg font-semibold mb-4">Available Devices</h2>
        <div className="space-y-2">
          {devices && devices.length > 0 ? (
            devices.map((device) => (
              <div key={device.id} className="text-sm">
                <span className="font-medium">{device.name}</span>
                {device.is_default && (
                  <span className="text-muted-foreground ml-2">(default)</span>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">
              {isTauri()
                ? 'No audio devices found'
                : 'Audio device selection requires Tauri'}
            </div>
          )}
        </div>
      </div>

      {/* Create Channel Dialog */}
      <CreateChannelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        devices={devices || []}
        onCreate={(name, deviceIds) => {
          createChannel.mutate({ name, device_ids: deviceIds });
        }}
      />

      {/* Edit Channel Dialog */}
      {editingChannel && (
        <EditChannelDialog
          open={!!editingChannel}
          onOpenChange={(open) => !open && setEditingChannel(null)}
          channel={channels?.find((c) => c.id === editingChannel)!}
          devices={devices || []}
          profiles={profiles || []}
          channelVoices={channelVoices?.profile_ids || []}
          onUpdate={(name, deviceIds) => {
            updateChannel.mutate({
              channelId: editingChannel,
              data: { name, device_ids: deviceIds },
            });
          }}
          onSetVoices={(profileIds) => {
            setChannelVoices.mutate({
              channelId: editingChannel,
              profileIds,
            });
          }}
        />
      )}
    </div>
  );
}

function ChannelVoicesList({ channelId }: { channelId: string }) {
  const { data: voices } = useQuery({
    queryKey: ['channel-voices', channelId],
    queryFn: () => apiClient.getChannelVoices(channelId),
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => apiClient.listProfiles(),
  });

  const voiceNames =
    voices?.profile_ids
      .map((id) => profiles?.find((p) => p.id === id)?.name)
      .filter(Boolean) || [];

  return (
    <div className="mt-1 text-sm text-muted-foreground">
      {voiceNames.length > 0 ? (
        <span>{voiceNames.join(', ')}</span>
      ) : (
        <span>No voices assigned</span>
      )}
    </div>
  );
}

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devices: AudioDevice[];
  onCreate: (name: string, deviceIds: string[]) => void;
}

function CreateChannelDialog({
  open,
  onOpenChange,
  devices,
  onCreate,
}: CreateChannelDialogProps) {
  const [name, setName] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  const handleSubmit = () => {
    if (name.trim()) {
      onCreate(name.trim(), selectedDevices);
      setName('');
      setSelectedDevices([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Audio Channel</DialogTitle>
          <DialogDescription>
            Create a new audio channel (bus) to route voices to specific output devices.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="channel-name">Channel Name</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Virtual Cable, Broadcast"
            />
          </div>
          <div>
            <Label>Output Devices</Label>
            <Select
              value={selectedDevices[0] || ''}
              onValueChange={(value) => {
                if (value && !selectedDevices.includes(value)) {
                  setSelectedDevices([...selectedDevices, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.name} {device.is_default && '(default)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDevices.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedDevices.map((deviceId) => {
                  const device = devices.find((d) => d.id === deviceId);
                  return (
                    <div
                      key={deviceId}
                      className="flex items-center justify-between text-sm bg-muted p-2 rounded"
                    >
                      <span>{device?.name || deviceId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDevices(selectedDevices.filter((id) => id !== deviceId))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: {
    id: string;
    name: string;
    device_ids: string[];
  };
  devices: AudioDevice[];
  profiles: Array<{ id: string; name: string }>;
  channelVoices: string[];
  onUpdate: (name: string, deviceIds: string[]) => void;
  onSetVoices: (profileIds: string[]) => void;
}

function EditChannelDialog({
  open,
  onOpenChange,
  channel,
  devices,
  profiles,
  channelVoices,
  onUpdate,
  onSetVoices,
}: EditChannelDialogProps) {
  const [name, setName] = useState(channel.name);
  const [selectedDevices, setSelectedDevices] = useState<string[]>(channel.device_ids);
  const [selectedVoices, setSelectedVoices] = useState<string[]>(channelVoices);

  const handleSubmit = () => {
    if (name.trim()) {
      onUpdate(name.trim(), selectedDevices);
      onSetVoices(selectedVoices);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Channel</DialogTitle>
          <DialogDescription>Update channel settings and voice assignments.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-channel-name">Channel Name</Label>
            <Input
              id="edit-channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Output Devices</Label>
            <Select
              value=""
              onValueChange={(value) => {
                if (value && !selectedDevices.includes(value)) {
                  setSelectedDevices([...selectedDevices, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.name} {device.is_default && '(default)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDevices.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedDevices.map((deviceId) => {
                  const device = devices.find((d) => d.id === deviceId);
                  return (
                    <div
                      key={deviceId}
                      className="flex items-center justify-between text-sm bg-muted p-2 rounded"
                    >
                      <span>{device?.name || deviceId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDevices(selectedDevices.filter((id) => id !== deviceId))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <Label>Assigned Voices</Label>
            <Select
              value=""
              onValueChange={(value) => {
                if (value && !selectedVoices.includes(value)) {
                  setSelectedVoices([...selectedVoices, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add voice" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVoices.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedVoices.map((profileId) => {
                  const profile = profiles.find((p) => p.id === profileId);
                  return (
                    <div
                      key={profileId}
                      className="flex items-center justify-between text-sm bg-muted p-2 rounded"
                    >
                      <span>{profile?.name || profileId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedVoices(selectedVoices.filter((id) => id !== profileId))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
