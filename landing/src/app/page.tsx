'use client';

import { Cloud, Code, Cpu, Github, Shield, Zap } from 'lucide-react';
import Image from 'next/image';
import { AppleIcon, LinuxIcon, WindowsIcon } from '@/components/PlatformIcons';
import { Button } from '@/components/ui/button';
import { Hero } from '@/components/ui/hero';
import { Section, SectionTitle } from '@/components/ui/section';
import { DOWNLOAD_LINKS, GITHUB_REPO } from '@/lib/constants';
import { FeatureCard } from '../components/ui/feature-card';

export default function Home() {
  const features = [
    {
      title: 'Near-Perfect Voice Cloning',
      description:
        "Powered by Alibaba's Qwen3-TTS model for exceptional voice quality and accuracy.",
      icon: <Zap className="h-6 w-6" />,
    },
    {
      title: 'Multi-Sample Support',
      description:
        'Combine multiple voice samples for higher quality and more natural-sounding results.',
      icon: <Code className="h-6 w-6" />,
    },
    {
      title: 'Smart Caching',
      description: 'Instant re-generation with voice prompt caching. No need to reprocess samples.',
      icon: <Zap className="h-6 w-6" />,
    },
    {
      title: 'Local or Remote',
      description:
        'Run GPU inference locally or connect to a remote machine. One-click server setup.',
      icon: <Cloud className="h-6 w-6" />,
    },
    {
      title: 'Audio Transcription',
      description:
        'Powered by Whisper for accurate speech-to-text. Extract reference text from voice samples automatically.',
      icon: <Shield className="h-6 w-6" />,
    },
    {
      title: 'Cross-Platform',
      description: 'Available for macOS, Windows, and Linux. No Python installation required.',
      icon: <Cpu className="h-6 w-6" />,
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16 md:space-y-20">
      {/* Hero Section */}
      <Hero
        title="voicebox"
        description="Open source voice cloning powered by Qwen3-TTS. Create natural-sounding speech from text with near-perfect voice replication."
        actions={
          <div className="space-y-4 w-full lg:w-auto">
            <div className="w-full max-w-2xl mb-6">
              <Image
                src="/App.webp"
                alt="Voicebox Application Screenshot"
                width={1920}
                height={1080}
                className="w-full h-auto rounded-lg border border-border shadow-lg"
                priority
              />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-1">Download</h2>
              <p className="text-sm text-muted-foreground">Choose your platform</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
              <Button asChild size="lg" className="w-full px-0">
                <a
                  href={DOWNLOAD_LINKS.macArm}
                  download
                  className="flex items-center w-full relative"
                >
                  <div className="flex items-center gap-2 flex-shrink-0 pl-4">
                    <AppleIcon className="h-5 w-5" />
                    <div className="h-5 w-px bg-border" />
                  </div>
                  <span className="flex-1 text-center px-4">macOS (ARM)</span>
                </a>
              </Button>
              <Button asChild size="lg" className="w-full px-0">
                <a
                  href={DOWNLOAD_LINKS.macIntel}
                  download
                  className="flex items-center w-full relative"
                >
                  <div className="flex items-center gap-2 flex-shrink-0 pl-4">
                    <AppleIcon className="h-5 w-5" />
                    <div className="h-5 w-px bg-border" />
                  </div>
                  <span className="flex-1 text-center px-4">macOS (Intel)</span>
                </a>
              </Button>
              <Button asChild size="lg" className="w-full px-0">
                <a
                  href={DOWNLOAD_LINKS.windows}
                  download
                  className="flex items-center w-full relative"
                >
                  <div className="flex items-center gap-2 flex-shrink-0 pl-4">
                    <WindowsIcon className="h-5 w-5" />
                    <div className="h-5 w-px bg-border" />
                  </div>
                  <span className="flex-1 text-center px-4">Windows</span>
                </a>
              </Button>
              <Button asChild size="lg" className="w-full px-0">
                <a
                  href={DOWNLOAD_LINKS.linux}
                  download
                  className="flex items-center w-full relative"
                >
                  <div className="flex items-center gap-2 flex-shrink-0 pl-4">
                    <LinuxIcon className="h-5 w-5" />
                    <div className="h-5 w-px bg-border" />
                  </div>
                  <span className="flex-1 text-center px-4">Linux</span>
                </a>
              </Button>
            </div>
            <Button variant="outline" size="lg" asChild className="w-full">
              <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4 mr-2" />
                View on GitHub
              </a>
            </Button>
          </div>
        }
      />

      {/* Features Section */}
      <Section id="features">
        <SectionTitle className="mb-4 text-center">Features</SectionTitle>
        <p className="text-sm text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
          Everything you need for professional voice cloning in a desktop app.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
