import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { MotionProvider } from "@/components/motion/motion-provider";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Qualia. Reason it through.",
    template: "%s · Qualia",
  },
  description:
    "A reasoning scaffold for students. Qualia guides your thinking, it doesn't solve problems for you.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c8f0d8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={inter.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("structura-theme");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.setAttribute("data-theme","dark");}}catch(e){}})();',
          }}
        />
        <MotionProvider>{children}</MotionProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
