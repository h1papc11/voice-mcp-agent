import { type NextRequest, NextResponse } from 'next/server';
import { getLatestRelease } from '@/lib/releases';

export const dynamic = 'force-dynamic';

const PLATFORM_MAP: Record<
  string,
  keyof Awaited<ReturnType<typeof getLatestRelease>>['downloadLinks']
> = {
  'mac-arm': 'macArm',
  'mac-intel': 'macIntel',
  windows: 'windows',
  linux: 'linux',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const key = PLATFORM_MAP[platform];

  if (!key) {
    return NextResponse.json(
      { error: `Unknown platform: ${platform}. Use: ${Object.keys(PLATFORM_MAP).join(', ')}` },
      { status: 404 },
    );
  }

  try {
    const release = await getLatestRelease();
    const url = release.downloadLinks[key];

    if (!url) {
      return NextResponse.json({ error: `No download available for ${platform}` }, { status: 404 });
    }

    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(`https://github.com/jamiepine/voicebox/releases/latest`);
  }
}
