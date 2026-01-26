import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { GITHUB_REPO } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="border-t border-border pt-8 sm:pt-12 pb-6 sm:pb-8 mt-12 sm:mt-16 md:mt-20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
          <div>
            <h3 className="font-bold text-lg mb-4">voicebox</h3>
            <p className="text-muted-foreground text-sm">
              Professional voice cloning powered by Qwen3-TTS. Desktop app for Mac, Windows, and
              Linux.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Product</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#download" className="hover:text-foreground transition-colors">
                  Download
                </a>
              </li>
              <li>
                <Link
                  href={GITHUB_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  GitHub
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Resources</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <Link
                  href={GITHUB_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Source Code
                </Link>
              </li>
              <li>
                <Link
                  href={`${GITHUB_REPO}/releases`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Releases
                </Link>
              </li>
              <li>
                <Link
                  href={`${GITHUB_REPO}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Issues
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <Separator className="my-8" />
        <div className="text-center text-muted-foreground text-sm space-y-2">
          <p>© 2026 voicebox. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
