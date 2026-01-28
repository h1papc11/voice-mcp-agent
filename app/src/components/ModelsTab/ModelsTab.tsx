import { ModelManagement } from '@/components/ServerSettings/ModelManagement';

export function ModelsTab() {
  return (
    <div className="space-y-4 overflow-y-auto flex flex-col">
      <ModelManagement />
    </div>
  );
}
