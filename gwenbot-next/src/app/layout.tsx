import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import ConditionalLayout from "@/components/conditional-layout";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import CookieConsent from "@/components/CookieConsent";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "xsgwen - Streameuse Twitch",
  description: "Site officiel de xsgwen - Streameuse Twitch",
  icons: {
    icon: "https://static-cdn.jtvnw.net/jtv_user_pictures/1efe260a-d1d3-4215-9c9f-5a24aea55625-profile_image-70x70.png",
  },
};

// Floral background component
const FloralBackground = () => (
  <div className="floral-bg">
    <svg className="flower flower-1" viewBox="0 0 100 100">
      <g transform="translate(50,50)">
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(0)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(60)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(120)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(180)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(240)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(300)" />
      </g>
    </svg>
    <svg className="flower flower-2" viewBox="0 0 100 100">
      <g transform="translate(50,50)">
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(0)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(60)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(120)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(180)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(240)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(300)" />
      </g>
    </svg>
    <svg className="flower flower-3" viewBox="0 0 100 100">
      <g transform="translate(50,50)">
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(0)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(60)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(120)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(180)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(240)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(300)" />
      </g>
    </svg>
    <svg className="flower flower-4" viewBox="0 0 100 100">
      <g transform="translate(50,50)">
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(0)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(60)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(120)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(180)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(240)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(300)" />
      </g>
    </svg>
    <svg className="flower flower-5" viewBox="0 0 100 100">
      <g transform="translate(50,50)">
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(0)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(60)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(120)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(180)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(240)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(300)" />
      </g>
    </svg>
    <svg className="flower flower-6" viewBox="0 0 100 100">
      <g transform="translate(50,50)">
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(0)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(60)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(120)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(180)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(240)" />
        <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(300)" />
      </g>
    </svg>
  </div>
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={poppins.className}>
        <GoogleAnalytics />
        <ConditionalLayout floralBackground={<FloralBackground />}>
          {children}
        </ConditionalLayout>
        <CookieConsent />
      </body>
    </html>
  );
}

