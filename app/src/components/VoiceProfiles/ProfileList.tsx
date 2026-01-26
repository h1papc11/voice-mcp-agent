import { Mic, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { useUIStore } from '@/stores/uiStore';
import { ProfileCard } from './ProfileCard';
import { ProfileForm } from './ProfileForm';

export function ProfileList() {
  const { data: profiles, isLoading, error } = useProfiles();
  const setDialogOpen = useUIStore((state) => state.setProfileDialogOpen);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading profiles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-destructive">Error loading profiles: {error.message}</div>
      </div>
    );
  }

  const allProfiles = profiles || [];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-2xl font-bold">Voicebox</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Sparkles className="mr-2 h-4 w-4" />
          New Profile
        </Button>
      </div>

      <div className="shrink-0">
        {allProfiles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mic className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No voice profiles yet. Create your first profile to get started.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Create Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-3 auto-rows-auto p-1">
            {allProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </div>

      <ProfileForm />
    </div>
  );
}
