import { NextResponse } from 'next/server';
import { getLatestRelease } from '@/lib/releases';

export const dynamic = 'force-dynamic';
export const revalidate = 600; // Revalidate every 10 minutes

export async function GET() {
  try {
    const releaseInfo = await getLatestRelease();
    return NextResponse.json(releaseInfo);
  } catch (error) {
    console.error('Error fetching release info:', error);
    return NextResponse.json({ error: 'Failed to fetch release information' }, { status: 500 });
  }
}
