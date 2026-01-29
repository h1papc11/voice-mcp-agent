import { Plus, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useStories, useCreateStory } from '@/lib/hooks/useStories';
import { useStoryStore } from '@/stores/storyStore';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';

export function StoryList() {
  const { data: stories, isLoading } = useStories();
  const selectedStoryId = useStoryStore((state) => state.selectedStoryId);
  const setSelectedStoryId = useStoryStore((state) => state.setSelectedStoryId);
  const createStory = useCreateStory();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newStoryName, setNewStoryName] = useState('');
  const [newStoryDescription, setNewStoryDescription] = useState('');
  const { toast } = useToast();

  const handleCreateStory = () => {
    if (!newStoryName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a story name',
        variant: 'destructive',
      });
      return;
    }

    createStory.mutate(
      {
        name: newStoryName.trim(),
        description: newStoryDescription.trim() || undefined,
      },
      {
        onSuccess: (story) => {
          setSelectedStoryId(story.id);
          setCreateDialogOpen(false);
          setNewStoryName('');
          setNewStoryDescription('');
          toast({
            title: 'Story created',
            description: `"${story.name}" has been created`,
          });
        },
        onError: (error) => {
          toast({
            title: 'Failed to create story',
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading stories...</div>
      </div>
    );
  }

  const storyList = stories || [];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-2xl font-bold">Stories</h2>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Story
        </Button>
      </div>

      {/* Story List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {storyList.length === 0 ? (
          <div className="text-center py-12 px-5 border-2 border-dashed border-muted rounded-md text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No stories yet</p>
            <p className="text-xs mt-2">Create your first story to get started</p>
          </div>
        ) : (
          storyList.map((story) => (
            <div
              key={story.id}
              className={cn(
                'p-4 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors',
                selectedStoryId === story.id && 'bg-muted border-primary',
              )}
              onClick={() => setSelectedStoryId(story.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{story.name}</h3>
                  {story.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {story.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{story.item_count} {story.item_count === 1 ? 'item' : 'items'}</span>
                    <span>•</span>
                    <span>{formatDate(story.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Story Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Story</DialogTitle>
            <DialogDescription>
              Create a new story to organize your voice generations into conversations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="story-name">Name</Label>
              <Input
                id="story-name"
                placeholder="My Story"
                value={newStoryName}
                onChange={(e) => setNewStoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateStory();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="story-description">Description (optional)</Label>
              <Textarea
                id="story-description"
                placeholder="A conversation between..."
                value={newStoryDescription}
                onChange={(e) => setNewStoryDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateStory} disabled={createStory.isPending}>
              {createStory.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
