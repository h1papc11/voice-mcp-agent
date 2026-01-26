'use client';

import { Download, Laptop, Monitor, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DOWNLOAD_LINKS, LATEST_VERSION } from '@/lib/constants';

export function DownloadSection() {
  const downloads = [
    {
      platform: 'Mac',
      icon: Laptop,
      link: DOWNLOAD_LINKS.macArm,
      description: 'macOS (Intel + Apple Silicon)',
      disabled: false,
    },
    {
      platform: 'Windows',
      icon: Monitor,
      link: DOWNLOAD_LINKS.windows,
      description: 'Windows x64',
      disabled: false,
    },
    {
      platform: 'Linux',
      icon: Terminal,
      link: DOWNLOAD_LINKS.linux,
      description: 'Linux AppImage',
      disabled: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">Latest Version</p>
        <p className="text-2xl font-bold">{LATEST_VERSION}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {downloads.map(({ platform, icon: Icon, link, description, disabled }) => (
          <Card
            key={platform}
            className={`transition-all duration-200 ${
              disabled
                ? 'opacity-50'
                : 'hover:border-primary/20 hover:shadow-lg hover:shadow-primary/3 hover:-translate-y-0.5'
            }`}
          >
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 rounded-xl bg-muted/50 backdrop-blur-sm border border-border">
                  <Icon className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{platform}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Button asChild size="lg" className="w-full" disabled={disabled}>
                  <a href={link} download className={disabled ? 'pointer-events-none' : ''}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
