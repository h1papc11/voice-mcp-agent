// Download links for voicebox releases
// These are fallback values - link to releases page if API fails
export const LATEST_VERSION = 'v0.1.0';

export const GITHUB_REPO = 'https://github.com/jamiepine/voicebox';
export const GITHUB_RELEASES_PAGE = `${GITHUB_REPO}/releases`;
export const DONATE_URL = 'https://buymeacoffee.com/jamiepine';

// $VOICEBOX — the official community token on Solana
export const TOKEN_TICKER = '$VOICEBOX';
export const TOKEN_CONTRACT_ADDRESS = 'FpzZHtp5tbvz6xndEtoJHoGEWcT7cFEuscdCh9RApump';
export const TOKEN_PUMP_URL = `https://pump.fun/coin/${TOKEN_CONTRACT_ADDRESS}`;

export const DOWNLOAD_LINKS = {
  macArm: GITHUB_RELEASES_PAGE,
  macIntel: GITHUB_RELEASES_PAGE,
  windows: GITHUB_RELEASES_PAGE,
  linux: GITHUB_RELEASES_PAGE,
} as const;

// Export function to get dynamic download links
export { getLatestRelease } from './releases';
