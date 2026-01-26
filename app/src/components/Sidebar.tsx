import { Home, Settings } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import voiceboxLogo from '@/assets/voicebox-logo.png';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'main', icon: Home, label: 'Main' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <div className="fixed left-0 top-0 h-full w-20 bg-sidebar border-r border-border flex flex-col items-center py-6 gap-6">
      {/* Logo */}
      <div className="mb-2">
        <img
          src={voiceboxLogo}
          alt="Voicebox"
          className="w-12 h-12 object-contain"
        />
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col gap-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200',
                'hover:bg-accent hover:text-accent-foreground',
                isActive ? 'bg-accent text-accent-foreground shadow-lg' : 'text-muted-foreground',
              )}
              title={tab.label}
              aria-label={tab.label}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
