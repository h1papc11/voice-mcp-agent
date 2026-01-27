import { Edit, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProfiles, useProfileSamples, useDeleteProfile } from '@/lib/hooks/useProfiles';
import { useHistory } from '@/lib/hooks/useHistory';
import { useUIStore } from '@/stores/uiStore';
import { apiClient } from '@/lib/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function VoicesTab() {
  const { data: profiles, isLoading } = useProfiles();
  const { data: historyData } = useHistory({ limit: 1000 });
  const queryClient = useQueryClient();
  const setDialogOpen = useUIStore((state) => state.setProfileDialogOpen);
  const setEditingProfileId = useUIStore((state) => state.setEditingProfileId);
  const deleteProfile = useDeleteProfile();

  // Get generation counts per profile
  const generationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (historyData?.items) {
      historyData.items.forEach((item) => {
        counts[item.profile_id] = (counts[item.profile_id] || 0) + 1;
      });
    }
    return counts;
  }, [historyData]);

  // Get channel assignments for each profile
  const { data: channelAssignments } = useQuery({
    queryKey: ['profile-channels'],
    queryFn: async () => {
      if (!profiles) return {};
      const assignments: Record<string, string[]> = {};
      for (const profile of profiles) {
        try {
          const result = await apiClient.getProfileChannels(profile.id);
          assignments[profile.id] = result.channel_ids;
        } catch {
          assignments[profile.id] = [];
        }
      }
      return assignments;
    },
    enabled: !!profiles,
  });

  // Get all channels
  const { data: channels } = useQuery({
    queryKey: ['channels'],
    queryFn: () => apiClient.listChannels(),
  });

  const handleEdit = (profileId: string) => {
    setEditingProfileId(profileId);
    setDialogOpen(true);
  };

  const handleDelete = (profileId: string) => {
    if (confirm('Are you sure you want to delete this profile?')) {
      deleteProfile.mutate(profileId);
    }
  };

  const handleChannelChange = async (profileId: string, channelIds: string[]) => {
    try {
      await apiClient.setProfileChannels(profileId, channelIds);
      queryClient.invalidateQueries({ queryKey: ['profile-channels'] });
    } catch (error) {
      console.error('Failed to update channels:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading voices...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Voices</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Voice
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Generations</TableHead>
              <TableHead>Samples</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles?.map((profile) => (
              <VoiceRow
                key={profile.id}
                profile={profile}
                generationCount={generationCounts[profile.id] || 0}
                channelIds={channelAssignments?.[profile.id] || []}
                channels={channels || []}
                onChannelChange={(channelIds) => handleChannelChange(profile.id, channelIds)}
                onEdit={() => handleEdit(profile.id)}
                onDelete={() => handleDelete(profile.id)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface VoiceRowProps {
  profile: {
    id: string;
    name: string;
    description: string | null;
    language: string;
  };
  generationCount: number;
  channelIds: string[];
  channels: Array<{ id: string; name: string; is_default: boolean }>;
  onChannelChange: (channelIds: string[]) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function VoiceRow({
  profile,
  generationCount,
  channelIds,
  channels,
  onChannelChange,
  onEdit,
  onDelete,
}: VoiceRowProps) {
  const { data: samples } = useProfileSamples(profile.id);

  return (
    <TableRow>
      <TableCell>
        <div>
          <div className="font-medium">{profile.name}</div>
          {profile.description && (
            <div className="text-sm text-muted-foreground">{profile.description}</div>
          )}
        </div>
      </TableCell>
      <TableCell>{profile.language}</TableCell>
      <TableCell>{generationCount}</TableCell>
      <TableCell>{samples?.length || 0}</TableCell>
      <TableCell>
        <select
          multiple
          value={channelIds}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
            onChannelChange(selected);
          }}
          className="w-full min-w-[200px] border rounded px-2 py-1 text-sm"
          size={Math.min(channels.length + 1, 5)}
        >
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name} {ch.is_default && '(Default)'}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
