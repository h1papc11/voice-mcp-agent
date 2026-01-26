# Voicebox Landing Page

Landing page for voicebox.sh - a modern Next.js 16 application.

## Tech Stack

- **Next.js 16** with App Router
- **Bun** for package management
- **Tailwind CSS** with shadcn/ui components
- **TypeScript** with strict mode
- **Railway** deployment ready

## Getting Started

### Prerequisites

- Bun installed ([bun.sh](https://bun.sh))

### Installation

```bash
cd landing
bun install
```

### Development

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the landing page.

### Build

```bash
bun run build
```

### Production

```bash
bun run start
```

## Configuration

### Update Download Links

Edit `src/lib/constants.ts` to update:
- `LATEST_VERSION` - Current release version
- `DOWNLOAD_LINKS` - GitHub release download URLs
- `GITHUB_REPO` - Repository URL

### Update GitHub Username

Replace `USERNAME` in `src/lib/constants.ts` with your actual GitHub username.

## Deployment to Railway

1. Connect your GitHub repository to Railway
2. Railway will auto-detect `nixpacks.toml`
3. Set root directory to `landing/`
4. Railway will automatically:
   - Install dependencies with `bun install`
   - Build with `bun run build`
   - Start with `bun run start`
5. Configure custom domain `voicebox.sh` in Railway settings

## Project Structure

```
landing/
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout with metadata
│   │   ├── page.tsx        # Landing page
│   │   └── globals.css     # Global styles
│   ├── components/
│   │   ├── Header.tsx      # Top navigation
│   │   ├── Footer.tsx      # Footer
│   │   ├── DownloadSection.tsx  # Download buttons
│   │   └── ui/             # shadcn/ui components
│   └── lib/
│       ├── utils.ts        # Utility functions
│       └── constants.ts    # App constants
├── public/
│   └── voicebox-logo.png   # Logo asset
└── nixpacks.toml          # Railway deployment config
```

## Features

- Responsive design (mobile-first)
- Dark mode by default
- SEO optimized metadata
- Download links for Mac, Windows, Linux
- Feature showcase
- Platform highlights
- GitHub integration
