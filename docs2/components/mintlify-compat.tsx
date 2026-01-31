/**
 * Compatibility components for Mintlify -> Fumadocs migration
 * Maps Mintlify components to Fumadocs equivalents
 */

import { Card, Cards } from 'fumadocs-ui/components/card';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Callout } from 'fumadocs-ui/components/callout';
import type { ReactNode } from 'react';
import * as Icons from 'lucide-react';

// Icon name to Lucide icon mapping
const iconMap: Record<string, typeof Icons.Mic> = {
  microphone: Icons.Mic,
  film: Icons.Film,
  code: Icons.Code,
  shield: Icons.Shield,
  download: Icons.Download,
  rocket: Icons.Rocket,
  apple: Icons.Apple,
  windows: Icons.Monitor, // Windows doesn't exist, using Monitor instead
  server: Icons.Server,
  user: Icons.User,
  waveform: Icons.Waves, // Waveform doesn't exist, using Waves instead
};

function getIcon(iconName?: string) {
  if (!iconName) return undefined;
  const IconComponent = iconMap[iconName.toLowerCase()];
  return IconComponent ? <IconComponent className="w-5 h-5" /> : undefined;
}

// Frame -> Simple image wrapper (Fumadocs images are zoomable by default)
export function Frame({ children }: { children: ReactNode }) {
  return <div className="my-6">{children}</div>;
}

// CardGroup -> Cards (Fumadocs component)
export function CardGroup({ 
  cols, 
  children 
}: { 
  cols?: number; 
  children: ReactNode;
}) {
  return <Cards style={{ gridTemplateColumns: cols ? `repeat(${cols}, 1fr)` : undefined }}>{children}</Cards>;
}

// Card -> Card (maps icon string to Lucide icon)
export function MintlifyCard({
  title,
  icon,
  href,
  children
}: {
  title?: string;
  icon?: string;
  href?: string;
  children: ReactNode;
}) {
  const iconElement = getIcon(icon);

  // Extract text content from children to avoid nested <p> tags
  // fumadocs Card component wraps description in a <p>, so we need plain content
  const description = typeof children === 'string'
    ? children
    : undefined;

  return (
    <Card
      title={title || ''}
      href={href}
      icon={iconElement}
      description={description}
    />
  );
}

// Steps and Step are direct mappings
export { Steps, Step };

// Callout variants - Note: Fumadocs doesn't have "note" type, using "info"
export function Tip({ children }: { children: ReactNode }) {
  return <Callout type="info">{children}</Callout>;
}

export function Note({ children }: { children: ReactNode }) {
  return <Callout type="info">{children}</Callout>;
}

export function Warning({ children }: { children: ReactNode }) {
  return <Callout type="warn">{children}</Callout>;
}

export function Info({ children }: { children: ReactNode }) {
  return <Callout type="info">{children}</Callout>;
}

export function Danger({ children }: { children: ReactNode }) {
  return <Callout type="error">{children}</Callout>;
}

// Accordion -> HTML details/summary (Fumadocs doesn't have built-in accordion)
export function AccordionGroup({ children }: { children: ReactNode }) {
  return <div className="my-6 space-y-2">{children}</div>;
}

export function Accordion({ 
  title, 
  children 
}: { 
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group border rounded-lg p-4">
      <summary className="cursor-pointer font-semibold list-none">
        <span className="group-open:rotate-90 transition-transform inline-block mr-2">▶</span>
        {title}
      </summary>
      <div className="mt-4 pl-6">{children}</div>
    </details>
  );
}
