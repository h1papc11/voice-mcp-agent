'use client';

import { Github } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GITHUB_REPO } from '@/lib/constants';

export function Header() {
  return (
    <header className="border-b border-border bg-background/60 backdrop-blur-2xl sticky top-0 z-50 supports-[backdrop-filter]:bg-background/40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl sm:text-2xl hover:opacity-80 transition-opacity tracking-tight"
          >
            Voicebox
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="outline" size="sm" asChild className="hidden sm:flex">
              <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </a>
            </Button>
            <Button variant="ghost" size="icon" asChild className="sm:hidden">
              <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <Github className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
