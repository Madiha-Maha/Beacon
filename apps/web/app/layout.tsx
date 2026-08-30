import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Atkinson_Hyperlegible } from "next/font/google";
import "@/styles/globals.css";

const atkinson = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-atkinson",
});

export const metadata: Metadata = {
  title: "Beacon — Real-Time AI Sight Companion",
  description:
    "An always-listening, audio-first AI companion that narrates your surroundings with hazard-first triage and a community hazard mesh.",
  applicationName: "Beacon",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Beacon",
  },
  manifest: "/manifest.webmanifest",
  icons: [
    { rel: "icon", url: "/manifest.webmanifest", type: "image/svg+xml" },
  ],
  openGraph: {
    title: "Beacon — Real-Time AI Sight Companion",
    description:
      "Always-listening AI companion that narrates your surroundings with hazard-first triage.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0E11",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-contrast="normal"
      className={`${atkinson.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem('beacon.contrast');if(c==='high')document.documentElement.setAttribute('data-contrast','high');}catch(e){}})();`,
          }}
        />
      </head>
      <body data-scroll-root>{children}</body>
    </html>
  );
}
