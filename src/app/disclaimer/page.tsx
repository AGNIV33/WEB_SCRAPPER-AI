import type { Metadata } from "next";
import LegalPage, { ContactLink, H2, List, OWNER, SITE } from "@/components/LegalPage";

export const metadata: Metadata = { title: `Disclaimer · ${SITE}`, description: `Important limits of ${SITE} reports.` };

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" current="/disclaimer">
      <p className="mt-4">Please read this before you rely on any {SITE} report.</p>

      <H2>1. Results are automated and may be wrong</H2>
      <List items={[
        "Reports are made by automatic tools and AI models (NVIDIA NIM and Google Gemini). AI can make mistakes, miss things, or make up details that look real.",
        "Scores (security, SEO, speed, accessibility, trust, carbon) are estimates. They are not a certificate, audit or guarantee.",
        "Results can change with time, location, device, blocking by the website, or limits of the free services we use.",
        "Always check important results yourself or with a qualified expert before you act on them.",
      ]} />

      <H2>2. Not professional advice</H2>
      <p className="mt-2">Nothing in {SITE} is legal, security, financial or business advice. The trust / scam check is only a set of signals; a good score does not prove a website is safe, and a low score does not prove it is a scam.</p>

      <H2>3. Passive checks only</H2>
      <p className="mt-2">{SITE} only reads what is publicly visible to a normal visitor. It does not log in, test passwords, send attack traffic, or try to break any website. It is not a penetration test.</p>

      <H2>4. Your responsibility</H2>
      <List items={[
        "Only scan websites you own or are allowed to analyse, and follow each website's terms and robots rules.",
        "Respect copyright and trademarks. Colours, fonts, code snippets and design.md are for learning and analysis, not for copying someone else's brand or work.",
        "Do not use reports to harm, attack or defame anyone.",
      ]} />

      <H2>5. Third-party websites and brands</H2>
      <p className="mt-2">Websites, logos and names shown in reports belong to their owners. {SITE} is not linked to, approved by, or working with them. Links to other websites are given only for convenience.</p>

      <H2>6. No warranty</H2>
      <p className="mt-2">{SITE} is provided &quot;as is&quot;, without any warranty. {OWNER} is not responsible for any loss that comes from using it.</p>

      <p className="mt-8 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">Found a wrong result or a problem? Tell us through the <ContactLink /> page.</p>
    </LegalPage>
  );
}
