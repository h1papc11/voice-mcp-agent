'use client';

import { motion } from 'framer-motion';
import { AudioLines, Cloud, Layers, MessageSquareText, Mic, Monitor } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ─── Lazy load wrapper ──────────────────────────────────────────────────────

function LazyLoad({
  children,
  className,
  rootMargin = '200px',
}: {
  children: React.ReactNode;
  className?: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : null}
    </div>
  );
}

// ─── Animation: Voice Cloning ───────────────────────────────────────────────

function VoiceCloningAnimation() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((p) => (p + 1) % 3);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const samples = ['Sample 1', 'Sample 2', 'Sample 3'];
  const bars = [0.4, 0.7, 0.5, 0.9, 0.3, 0.6, 0.8, 0.4, 0.7, 0.5, 0.3, 0.6];

  return (
    <div className="h-40 w-full flex items-center justify-center overflow-hidden rounded-md bg-app-darkerBox/50 p-4">
      <div className="flex flex-col items-center gap-3 w-full max-w-[200px]">
        {/* Sample pills */}
        <div className="flex gap-1.5">
          {samples.map((s, i) => (
            <motion.div
              key={s}
              className="text-[9px] px-2 py-1 rounded-full border font-medium"
              animate={{
                borderColor: i === phase ? 'hsl(43 50% 45% / 0.5)' : 'rgba(255,255,255,0.06)',
                backgroundColor: i === phase ? 'hsl(43 50% 45% / 0.08)' : 'rgba(255,255,255,0.02)',
                color: i === phase ? 'hsl(43 50% 45%)' : 'rgba(255,255,255,0.4)',
              }}
              transition={{ duration: 0.3 }}
            >
              {s}
            </motion.div>
          ))}
        </div>

        {/* Waveform visualization */}
        <div className="flex items-center gap-[2px] h-10 w-full justify-center">
          {bars.map((h, i) => (
            <motion.div
              key={i}
              className="w-[4px] rounded-full"
              animate={{
                height: `${h * 100}%`,
                backgroundColor: phase === 2 ? 'hsl(43 50% 45%)' : 'rgba(255,255,255,0.15)',
              }}
              transition={{
                height: { duration: 0.6, delay: i * 0.04, ease: 'easeInOut' },
                backgroundColor: { duration: 0.3 },
              }}
            />
          ))}
        </div>

        {/* Result label */}
        <motion.div
          className="text-[9px] font-mono"
          animate={{
            opacity: phase === 2 ? 1 : 0.3,
            color: phase === 2 ? 'hsl(43 50% 45%)' : 'rgba(255,255,255,0.3)',
          }}
          transition={{ duration: 0.3 }}
        >
          voice profile ready
        </motion.div>
      </div>
    </div>
  );
}

// ─── Animation: Stories Editor ───────────────────────────────────────────────

function StoriesAnimation() {
  const [activeTrack, setActiveTrack] = useState(0);
  const tracks = [
    {
      name: 'Narrator',
      color: '#ac8a2b',
      clips: [
        { w: '45%', x: '5%' },
        { w: '30%', x: '60%' },
      ],
    },
    {
      name: 'Character A',
      color: '#3b82f6',
      clips: [
        { w: '25%', x: '15%' },
        { w: '35%', x: '50%' },
      ],
    },
    { name: 'Character B', color: '#8b5cf6', clips: [{ w: '20%', x: '30%' }] },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTrack((p) => (p + 1) % tracks.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [tracks.length]);

  return (
    <div className="h-40 w-full flex flex-col justify-center overflow-hidden rounded-md bg-app-darkerBox/50 p-4 gap-2">
      {tracks.map((track, i) => (
        <motion.div
          key={track.name}
          className="flex items-center gap-2 h-8 rounded border px-2"
          animate={{
            borderColor: i === activeTrack ? `${track.color}40` : 'rgba(255,255,255,0.06)',
            backgroundColor: i === activeTrack ? `${track.color}08` : 'rgba(255,255,255,0.02)',
          }}
          transition={{ duration: 0.3 }}
        >
          <span
            className="text-[8px] w-14 shrink-0 truncate"
            style={{ color: i === activeTrack ? track.color : 'rgba(255,255,255,0.3)' }}
          >
            {track.name}
          </span>
          <div className="flex-1 relative h-4">
            {track.clips.map((clip, j) => (
              <motion.div
                key={j}
                className="absolute h-full rounded-sm"
                style={{
                  left: clip.x,
                  width: clip.w,
                  backgroundColor:
                    i === activeTrack ? `${track.color}30` : 'rgba(255,255,255,0.04)',
                  borderLeft: `2px solid ${i === activeTrack ? track.color : 'rgba(255,255,255,0.1)'}`,
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Animation: Multi-Sample ────────────────────────────────────────────────

function MultiSampleAnimation() {
  const [active, setActive] = useState(0);
  const samples = [
    { label: 'interview_clip.wav', dur: '12.4s', quality: 0.92 },
    { label: 'podcast_intro.wav', dur: '8.1s', quality: 0.88 },
    { label: 'narration_take3.wav', dur: '15.7s', quality: 0.95 },
    { label: 'casual_chat.wav', dur: '6.2s', quality: 0.85 },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((p) => (p + 1) % samples.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [samples.length]);

  return (
    <div className="h-40 w-full flex flex-col justify-center overflow-hidden rounded-md bg-app-darkerBox/50 p-4 gap-1.5">
      {samples.map((s, i) => (
        <motion.div
          key={s.label}
          className="flex items-center gap-2 px-2 py-1.5 rounded border text-[9px]"
          animate={{
            borderColor: i === active ? 'hsl(43 50% 45% / 0.4)' : 'rgba(255,255,255,0.06)',
            backgroundColor: i === active ? 'hsl(43 50% 45% / 0.06)' : 'rgba(255,255,255,0.02)',
          }}
          transition={{ duration: 0.3 }}
        >
          <span
            className={`flex-1 font-mono truncate ${i === active ? 'text-accent' : 'text-ink-faint'}`}
          >
            {s.label}
          </span>
          <span className="text-ink-faint shrink-0">{s.dur}</span>
          <div className="w-10 h-1 rounded-full bg-app-line shrink-0 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-accent"
              animate={{ width: i === active ? `${s.quality * 100}%` : '0%' }}
              transition={{ duration: 0.5, delay: i === active ? 0.2 : 0 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Animation: Local or Remote ─────────────────────────────────────────────

function LocalRemoteAnimation() {
  const [mode, setMode] = useState(0);
  const modes = ['Local GPU', 'Remote Server'];

  useEffect(() => {
    const interval = setInterval(() => {
      setMode((p) => (p + 1) % 2);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-40 w-full flex items-center justify-center overflow-hidden rounded-md bg-app-darkerBox/50 p-4">
      <div className="flex flex-col items-center gap-4 w-full max-w-[180px]">
        {/* Toggle */}
        <div className="flex gap-1 p-0.5 rounded-full border border-app-line bg-app-darkerBox">
          {modes.map((m, i) => (
            <motion.div
              key={m}
              className="text-[9px] px-3 py-1 rounded-full font-medium"
              animate={{
                backgroundColor: i === mode ? 'hsl(43 50% 45%)' : 'transparent',
                color: i === mode ? 'hsl(30 10% 94%)' : 'rgba(255,255,255,0.35)',
              }}
              transition={{ duration: 0.25 }}
            >
              {m}
            </motion.div>
          ))}
        </div>

        {/* Status */}
        <div className="flex flex-col items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full"
            animate={{
              backgroundColor: mode === 0 ? '#4ade80' : '#3b82f6',
              boxShadow: mode === 0 ? '0 0 8px #4ade80' : '0 0 8px #3b82f6',
            }}
            transition={{ duration: 0.3 }}
          />
          <span className="text-[9px] text-ink-faint font-mono">
            {mode === 0 ? 'Metal acceleration active' : 'Connected to 192.168.1.50'}
          </span>
          <span className="text-[8px] text-ink-faint/60 font-mono">
            {mode === 0 ? 'VRAM: 8.2 / 16.0 GB' : 'Latency: 12ms | CUDA'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Animation: Transcription ───────────────────────────────────────────────

function TranscriptionAnimation() {
  const [charIndex, setCharIndex] = useState(0);
  const text = 'The quick brown fox jumps over the lazy dog near the riverbank.';

  useEffect(() => {
    const interval = setInterval(() => {
      setCharIndex((p) => {
        if (p >= text.length) return 0;
        return p + 1;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [text.length]);

  return (
    <div className="h-40 w-full flex flex-col items-center justify-center overflow-hidden rounded-md bg-app-darkerBox/50 p-4 gap-3">
      {/* Fake waveform */}
      <div className="flex items-center gap-[1px] h-6 w-full max-w-[180px] justify-center">
        {Array.from({ length: 30 }, (_, i) => {
          const h = 0.2 + 0.8 * Math.abs(Math.sin(i * 0.5 + charIndex * 0.1));
          const active = i < (charIndex / text.length) * 30;
          return (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-colors duration-100 ${
                active ? 'bg-accent' : 'bg-app-line'
              }`}
              style={{ height: `${h * 100}%` }}
            />
          );
        })}
      </div>

      {/* Transcribed text */}
      <div className="text-[10px] text-ink-dull font-mono max-w-[200px] text-center leading-relaxed min-h-[32px]">
        {text.slice(0, charIndex)}
        {charIndex < text.length && (
          <span className="inline-block w-[2px] h-3 bg-accent animate-pulse ml-[1px] align-middle" />
        )}
      </div>
    </div>
  );
}

// ─── Animation: Cross-Platform ──────────────────────────────────────────────

function CrossPlatformAnimation() {
  const [active, setActive] = useState(0);
  const platforms = [
    { name: 'macOS', icon: '🍎', detail: 'Metal acceleration' },
    { name: 'Windows', icon: '🪟', detail: 'CUDA acceleration' },
    { name: 'Linux', icon: '🐧', detail: 'CUDA acceleration' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((p) => (p + 1) % platforms.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [platforms.length]);

  return (
    <div className="h-40 w-full flex items-center justify-center overflow-hidden rounded-md bg-app-darkerBox/50 p-4">
      <div className="flex gap-3">
        {platforms.map((p, i) => (
          <motion.div
            key={p.name}
            className="flex flex-col items-center gap-2 px-3 py-2.5 rounded-lg border"
            animate={{
              borderColor: i === active ? 'hsl(43 50% 45% / 0.4)' : 'rgba(255,255,255,0.06)',
              backgroundColor: i === active ? 'hsl(43 50% 45% / 0.06)' : 'rgba(255,255,255,0.02)',
              scale: i === active ? 1.05 : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-lg">{p.icon}</span>
            <span
              className={`text-[9px] font-medium ${i === active ? 'text-accent' : 'text-ink-faint'}`}
            >
              {p.name}
            </span>
            <span
              className={`text-[7px] font-mono ${i === active ? 'text-ink-dull' : 'text-ink-faint/50'}`}
            >
              {p.detail}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature data ───────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: 'Near-Perfect Voice Cloning',
    description:
      'Powered by Qwen3-TTS for exceptional voice quality. Clone any voice from a few seconds of audio with natural intonation and emotion.',
    icon: Mic,
    animation: VoiceCloningAnimation,
  },
  {
    title: 'Stories Editor',
    description:
      'Create multi-voice narratives with a timeline-based editor. Arrange tracks, trim clips, and mix conversations between characters.',
    icon: AudioLines,
    animation: StoriesAnimation,
  },
  {
    title: 'Multi-Sample Support',
    description:
      'Combine multiple voice samples for higher quality results. More samples means more natural-sounding speech synthesis.',
    icon: Layers,
    animation: MultiSampleAnimation,
  },
  {
    title: 'Local or Remote',
    description:
      'Run GPU inference locally with Metal or CUDA, or connect to a remote machine. One-click server setup with automatic discovery.',
    icon: Cloud,
    animation: LocalRemoteAnimation,
  },
  {
    title: 'Audio Transcription',
    description:
      'Powered by Whisper for accurate speech-to-text. Automatically extract reference text from voice samples.',
    icon: MessageSquareText,
    animation: TranscriptionAnimation,
  },
  {
    title: 'Cross-Platform',
    description:
      'Available for macOS, Windows, and Linux. No Python installation required — everything is bundled.',
    icon: Monitor,
    animation: CrossPlatformAnimation,
  },
];

// ─── Feature Card ───────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof FEATURES)[number] }) {
  const Icon = feature.icon;
  const Animation = feature.animation;

  return (
    <div className="rounded-lg border border-app-line bg-app-darkBox overflow-hidden">
      <LazyLoad>
        <Animation />
      </LazyLoad>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-accent" />
          <h3 className="text-[15px] font-medium text-foreground">{feature.title}</h3>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
      </div>
    </div>
  );
}

// ─── Features Section ───────────────────────────────────────────────────────

export function Features() {
  return (
    <section id="features" className="border-t border-border py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl mb-4">
            Professional voice tools, zero compromise
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Everything you need to clone voices, generate speech, and produce multi-voice content —
            running entirely on your machine.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
