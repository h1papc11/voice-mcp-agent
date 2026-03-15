'use client';

import { Github } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ControlUI } from '@/components/ControlUI';
import { Features } from '@/components/Features';
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { AppleIcon, LinuxIcon, WindowsIcon } from '@/components/PlatformIcons';
import { DOWNLOAD_LINKS, GITHUB_REPO } from '@/lib/constants';
import type { DownloadLinks } from '@/lib/releases';

export default function Home() {
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinks>(DOWNLOAD_LINKS);

  useEffect(() => {
    fetch('/api/releases')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch releases');
        return res.json();
      })
      .then((data) => {
        if (data.downloadLinks) setDownloadLinks(data.downloadLinks);
      })
      .catch((error) => {
        console.error('Failed to fetch release info:', error);
      });
  }, []);

  return (
    <>
      <Navbar />

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16">
        {/* Background glow */}
        <div className="hero-glow pointer-events-none absolute inset-0 -top-32">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-accent/15 blur-[150px]" />
          <div className="absolute left-1/2 top-12 -translate-x-1/2 w-[500px] h-[400px] rounded-full bg-accent/10 blur-[80px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 text-center">
          {/* Logo */}
          <div
            className="fade-in mx-auto mb-8 h-[120px] w-[120px] md:h-[160px] md:w-[160px]"
            style={{ animationDelay: '0ms' }}
          >
            <Image
              src="/voicebox-logo-app.webp"
              alt="Voicebox"
              width={160}
              height={160}
              className="h-full w-full object-contain"
              style={{
                filter:
                  'drop-shadow(0 0 20px hsl(43 60% 50% / 0.4)) drop-shadow(0 0 60px hsl(43 60% 50% / 0.2))',
              }}
              priority
            />
          </div>

          {/* Headline */}
          <div className="fade-in relative" style={{ animationDelay: '100ms' }}>
            <h1 className="text-5xl font-bold tracking-tighter leading-[0.9] text-foreground drop-shadow-[0_16px_50px_rgba(0,0,0,0.95)] md:text-7xl lg:text-8xl">
              Your voice, your machine.
            </h1>
          </div>

          {/* Subtitle */}
          <p
            className="fade-in mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
            style={{ animationDelay: '200ms' }}
          >
            Open source voice cloning studio powered by Qwen3-TTS. Clone any voice, generate natural
            speech, and compose multi-voice projects — all running locally.
          </p>

          {/* CTAs */}
          <div
            className="fade-in mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animationDelay: '300ms' }}
          >
            <a
              href="#download"
              className="rounded-full bg-accent px-8 py-3.5 text-sm font-semibold uppercase tracking-wider text-white shadow-[0_4px_20px_hsl(43_60%_50%/0.3),inset_0_2px_0_rgba(255,255,255,0.2),inset_0_-2px_0_rgba(0,0,0,0.1)] transition-all hover:bg-accent-faint active:shadow-[0_2px_10px_hsl(43_60%_50%/0.3),inset_0_4px_8px_rgba(0,0,0,0.3)]"
            >
              Download
            </a>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-border/60 bg-card/40 backdrop-blur-sm px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-border"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
          </div>

          {/* Version */}
          <p
            className="fade-in mt-4 text-xs text-muted-foreground/50"
            style={{ animationDelay: '400ms' }}
          >
            Free and open source &middot; macOS, Windows, Linux
          </p>
        </div>

        {/* ── ControlUI mockup ─────────────────────────────────────── */}
        <div className="mt-16">
          <ControlUI />
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <Features />

      {/* ── About / Manifesto ────────────────────────────────────── */}
      <section id="about" className="border-t border-border py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Why Voicebox exists
          </h2>
          <div className="space-y-6 text-center">
            <p className="text-base leading-relaxed text-muted-foreground">
              Cloud voice cloning services lock your voice data behind subscriptions, rate limits,
              and terms of service that can change at any time. Your voice — and the voices you
              clone — should belong to you.
            </p>
            <p className="text-lg font-medium text-foreground">
              Voicebox is a local-first voice cloning studio. Download a model, clone any voice from
              a few seconds of audio, and generate speech entirely on your machine.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Optimized with Metal acceleration on Mac and CUDA on Windows/Linux. No Python install
              required. No cloud. No subscriptions. Free and open-source, forever.
            </p>
          </div>
        </div>
      </section>

      {/* ── Download Section ─────────────────────────────────────── */}
      <section id="download" className="border-t border-border py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl mb-4">
              Download Voicebox
            </h2>
            <p className="text-muted-foreground">
              Available for macOS, Windows, and Linux. No dependencies required.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {/* macOS ARM */}
            <a
              href={downloadLinks.macArm}
              download
              className="flex items-center rounded-xl border border-border bg-card/60 backdrop-blur-sm px-5 py-4 transition-all hover:border-accent/30 hover:bg-card group"
            >
              <AppleIcon className="h-6 w-6 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="ml-4">
                <div className="text-sm font-medium">macOS</div>
                <div className="text-xs text-muted-foreground">Apple Silicon (ARM)</div>
              </div>
            </a>

            {/* macOS Intel */}
            <a
              href={downloadLinks.macIntel}
              download
              className="flex items-center rounded-xl border border-border bg-card/60 backdrop-blur-sm px-5 py-4 transition-all hover:border-accent/30 hover:bg-card group"
            >
              <AppleIcon className="h-6 w-6 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="ml-4">
                <div className="text-sm font-medium">macOS</div>
                <div className="text-xs text-muted-foreground">Intel (x64)</div>
              </div>
            </a>

            {/* Windows */}
            <a
              href={downloadLinks.windows}
              download
              className="flex items-center rounded-xl border border-border bg-card/60 backdrop-blur-sm px-5 py-4 transition-all hover:border-accent/30 hover:bg-card group"
            >
              <WindowsIcon className="h-6 w-6 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="ml-4">
                <div className="text-sm font-medium">Windows</div>
                <div className="text-xs text-muted-foreground">64-bit (MSI)</div>
              </div>
            </a>

            {/* Linux */}
            <div
              className="flex items-center rounded-xl border border-border bg-card/60 backdrop-blur-sm px-5 py-4 opacity-50 cursor-not-allowed"
              title="Linux builds coming soon"
            >
              <LinuxIcon className="h-6 w-6 shrink-0 text-muted-foreground" />
              <div className="ml-4">
                <div className="text-sm font-medium">Linux</div>
                <div className="text-xs text-muted-foreground">Coming soon</div>
              </div>
            </div>
          </div>

          {/* GitHub link */}
          <div className="mt-6 text-center">
            <a
              href={`${GITHUB_REPO}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              View all releases on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <Footer />
    </>
  );
}
