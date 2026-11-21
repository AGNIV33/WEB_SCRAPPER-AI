import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Scrapper AI · Website Analyzer",
  description: "Analyze any website: colours, fonts, pages, screenshots, animations, security, SEO and design.md",
};

// Sets the saved theme before first paint (no flash).
const themeScript = `try{var s=JSON.parse(localStorage.getItem('settings')||'{}'),t=s.theme||localStorage.getItem('theme')||'light',c=document.documentElement.classList;if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))c.add('dark');if(s.glass)c.add('glass');if(s.motion===false)c.add('no-motion')}catch(e){}
// Some browser extensions (e.g. Bitdefender) add attributes like bis_skin_checked before React loads,
// which causes hydration warnings. Strip them during startup.
try{var o=new MutationObserver(function(ms){ms.forEach(function(m){m.target.removeAttribute&&m.target.removeAttribute(m.attributeName)})});o.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['bis_skin_checked','bis_register','bis_use','bis_size','bis_id']});setTimeout(function(){o.disconnect()},10000)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full" suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">{themeScript}</Script>
        {children}
      </body>
    </html>
  );
}
