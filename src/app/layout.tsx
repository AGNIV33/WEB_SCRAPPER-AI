import type { Metadata } from "next";
import { Inter, Geist_Mono, Dancing_Script } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const signature = Dancing_Script({ variable: "--font-dancing", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Scrapper AI · Website Analyzer",
  description: "Analyze any website: colours, fonts, pages, screenshots, animations, security, SEO and design.md",
};

// Sets the saved theme before first paint (no flash).
const themeScript = `try{var s=JSON.parse(localStorage.getItem('settings')||'{}'),t=s.theme||localStorage.getItem('theme')||'light',c=document.documentElement.classList;if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))c.add('dark');if(s.glass)c.add('glass');if(s.motion===false)c.add('no-motion')}catch(e){}
// Some browser extensions (e.g. Bitdefender) add attributes like bis_skin_checked before React loads,
// which causes hydration warnings. Strip them during startup.
try{var A=['bis_skin_checked','bis_register','bis_use','bis_size','bis_id'],strip=function(){A.forEach(function(a){document.querySelectorAll('['+a+']').forEach(function(e){e.removeAttribute(a)})})};strip();var o=new MutationObserver(function(ms){ms.forEach(function(m){if(m.attributeName&&m.target.removeAttribute)m.target.removeAttribute(m.attributeName)})});o.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:A});document.addEventListener('DOMContentLoaded',strip);setTimeout(function(){o.disconnect()},15000)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} ${signature.variable} h-full antialiased`}>
      <head>
        {/* Plain inline script in <head>: runs while the page is still being parsed, before any extension can stamp the body */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
