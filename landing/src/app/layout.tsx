import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Voicebox - Open Source Voice Cloning Desktop App',
  description:
    'Near-perfect voice cloning powered by Qwen3-TTS. Desktop app for Mac, Windows, and Linux. Multi-sample support, smart caching, local or remote inference.',
  keywords: [
    'voice cloning',
    'TTS',
    'Qwen3',
    'desktop app',
    'AI voice',
    'open source',
    'text to speech',
  ],
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Voicebox',
    description: 'Open source voice cloning. Local-first. Free forever.',
    type: 'website',
    url: 'https://voicebox.sh',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body>
        <div className="relative min-h-screen bg-background font-sans">{children}</div>
      </body>
    </html>
  );
}
