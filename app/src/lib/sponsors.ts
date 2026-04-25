export type Sponsor = {
  name: string;
  url: string;
  logoSrc: string;
  logoAlt?: string;
  /** Set true for solid-black logos that need to flip white in dark mode. */
  invertOnDark?: boolean;
};

export const SPONSORS: Sponsor[] = [];
