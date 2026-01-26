// Fetch latest release information from GitHub
export interface DownloadLinks {
  macArm: string;
  macIntel: string;
  windows: string;
  linux: string;
}

export interface ReleaseInfo {
  version: string;
  downloadLinks: DownloadLinks;
}

const GITHUB_REPO = 'jamiepine/voicebox';
const GITHUB_API_BASE = 'https://api.github.com';

// Cache for release info (in-memory cache, resets on server restart)
let cachedReleaseInfo: ReleaseInfo | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 1000 * 60 * 10; // 10 minutes

/**
 * Fetches the latest release from GitHub and extracts download links
 */
export async function getLatestRelease(): Promise<ReleaseInfo> {
  // Return cached data if still valid
  const now = Date.now();
  if (cachedReleaseInfo && now - cacheTimestamp < CACHE_DURATION) {
    return cachedReleaseInfo;
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`, {
      next: { revalidate: 600 }, // Revalidate every 10 minutes
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const release = await response.json();
    const version = release.tag_name;
    const assets = release.assets || [];

    // Extract download links based on file patterns
    const downloadLinks: Partial<DownloadLinks> = {};

    for (const asset of assets) {
      const name = asset.name.toLowerCase();
      const url = asset.browser_download_url;

      if (name.includes('aarch64') || name.includes('arm64')) {
        downloadLinks.macArm = url;
      } else if (name.includes('x64') && name.includes('.dmg')) {
        downloadLinks.macIntel = url;
      } else if (name.includes('.msi')) {
        downloadLinks.windows = url;
      } else if (name.includes('.appimage') || name.includes('.deb')) {
        downloadLinks.linux = url;
      }
    }

    // Fallback: construct URLs if not found in assets
    const baseUrl = `https://github.com/${GITHUB_REPO}/releases/download/${version}`;

    const releaseInfo: ReleaseInfo = {
      version,
      downloadLinks: {
        macArm:
          downloadLinks.macArm || `${baseUrl}/voicebox_${version.replace('v', '')}_aarch64.dmg`,
        macIntel:
          downloadLinks.macIntel || `${baseUrl}/voicebox_${version.replace('v', '')}_x64.dmg`,
        windows:
          downloadLinks.windows || `${baseUrl}/voicebox_${version.replace('v', '')}_x64_en-US.msi`,
        linux: downloadLinks.linux || `${baseUrl}/voicebox_x86_64-unknown-linux-gnu.AppImage`,
      },
    };

    // Update cache
    cachedReleaseInfo = releaseInfo;
    cacheTimestamp = now;

    return releaseInfo;
  } catch (error) {
    console.error('Failed to fetch latest release:', error);
    throw error;
  }
}
