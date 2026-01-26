'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HeroProps {
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  className?: string;
  showLogo?: boolean;
}

export function Hero({ title, description, actions, className, showLogo = true }: HeroProps) {
  return (
    <section className={cn('relative py-12 sm:py-16 md:py-20 lg:py-24', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left side - Content */}
        <div className="space-y-6 lg:pr-8">
          {showLogo && (
            <div className="flex lg:justify-start justify-center mb-6">
              <Image
                src="/voicebox-logo-2.png"
                alt="Voicebox Logo"
                width={1024}
                height={1024}
                className="w-32 sm:w-40 md:w-48 h-auto"
                priority
              />
            </div>
          )}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-tight text-left">
            {title}
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-foreground/70 max-w-xl text-left">
            {description}
          </p>
        </div>

        {/* Right side - Actions */}
        <div className="flex flex-col items-start lg:items-end gap-4">{actions}</div>
      </div>
    </section>
  );
}
