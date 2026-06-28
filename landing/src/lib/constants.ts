// Download links for voicebox releases
// These are fallback values - link to releases page if API fails
export const LATEST_VERSION = 'v0.1.0';

export const GITHUB_REPO = 'https://github.com/jamiepine/voicebox';
export const GITHUB_RELEASES_PAGE = `${GITHUB_REPO}/releases`;
export const DONATE_URL = 'https://buymeacoffee.com/jamiepine';
export const SPONSOR_CHECKOUT_URL = 'https://buy.stripe.com/eVqdRad3n16ubcqf201Jm00';
export const SPONSOR_CONTACT_EMAIL = 'jamie@spacedrive.com';

// $VOICEBOX — the official community token on Solana
export const TOKEN_TICKER = '$VOICEBOX';
export const TOKEN_CONTRACT_ADDRESS = 'FpzZHtp5tbvz6xndEtoJHoGEWcT7cFEuscdCh9RApump';
export const TOKEN_PUMP_URL = `https://pump.fun/coin/${TOKEN_CONTRACT_ADDRESS}`;
// Solscan token page — lets anyone inspect supply, holders, and history.
export const TOKEN_SOLSCAN_URL = `https://solscan.io/token/${TOKEN_CONTRACT_ADDRESS}`;
export const TOKEN_TOTAL_SUPPLY = '1B';

// On-chain transparency log — locks and buyback+burns.
// Add a new entry every time a lock or burn happens; set `txUrl` to its Solscan
// link to make the card a live, verifiable proof. Entries without a txUrl render
// as "proof link pending" — fill them in as soon as the hash is available.
export interface TokenProof {
  kind: 'lock' | 'burn';
  label: string;
  detail: string;
  /** Solscan (or locker) URL proving the action. Empty = pending, shown as such. */
  txUrl: string;
}

export const TOKEN_PROOFS: TokenProof[] = [
  {
    kind: 'lock',
    label: 'Launch liquidity lock',
    detail:
      'Liquidity and a portion of dev holdings were locked at launch (~6.6% top holder), so the supply can be verified on-chain from day one.',
    txUrl: '', // TODO(jamie): add the Solscan/locker link for the launch lock
  },
  {
    kind: 'burn',
    label: 'Buyback & burn',
    detail:
      'Bought $VOICEBOX back from the open market and burned it to a dead address, permanently removing it from supply.',
    txUrl:
      'https://solscan.io/tx/5MjK4CYMBKAewLcjdD6QkM8ctkeG2bjyQhpjNgEumkDbDtoKCVmzKcWwLWsd4QJov8hs5zbGLt3g5vVCp4CBmze5',
  },
  {
    kind: 'burn',
    label: 'Buyback & burn',
    detail:
      'A second buyback and burn — part of an ongoing commitment to keep buying back and reducing supply over time.',
    txUrl: '', // TODO(jamie): add the Solscan link for the second burn
  },
];

export const DOWNLOAD_LINKS = {
  macArm: GITHUB_RELEASES_PAGE,
  macIntel: GITHUB_RELEASES_PAGE,
  windows: GITHUB_RELEASES_PAGE,
  linux: GITHUB_RELEASES_PAGE,
} as const;

// Export function to get dynamic download links
export { getLatestRelease } from './releases';
