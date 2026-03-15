'use client';

import { Github } from 'lucide-react';
import Image from 'next/image';
import { GITHUB_REPO } from '@/lib/constants';

export function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Logo + wordmark */}
        <a href="/" className="flex items-center gap-2.5">
          <Image
            src="/voicebox-logo-app.webp"
            alt="Voicebox"
            width={28}
            height={28}
            className="h-7 w-7"
          />
          <span className="text-[15px] font-semibold text-foreground">Voicebox</span>
        </a>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-1">
          <a
            href="#features"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#about"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            About
          </a>
          <a
            href="#download"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Download
          </a>
        </div>

        {/* GitHub star button */}
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:border-border"
        >
          <Github className="h-4 w-4" />
          <span className="hidden sm:inline">Star on GitHub</span>
          <span className="sm:hidden">GitHub</span>
        </a>
      </div>
    </nav>
  );
}
