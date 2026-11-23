import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { ContactLink, H2, List, OWNER, SITE } from "@/components/LegalPage";

export const metadata: Metadata = { title: `Terms of Use · ${SITE}`, description: `The rules for using ${SITE}.` };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" current="/terms">
      <p className="mt-4">These terms are an agreement between you and {OWNER}, who runs {SITE} from India. By using {SITE}, or by creating an account, you agree to these terms, our <Link href="/privacy" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Privacy Policy</Link> and our <Link href="/disclaimer" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Disclaimer</Link>. If you do not agree, please do not use the service.</p>

      <H2>1. What the service does</H2>
      <p className="mt-2">{SITE} visits public web pages you choose and makes an automated report: design (colours, fonts, animations), tech stack, SEO, speed, accessibility, security headers, trust signals, and AI suggestions. It only does passive checks, the same things a normal visitor&apos;s browser can see.</p>

      <H2>2. Who can use it</H2>
      <List items={[
        "You must be 18 or older to create an account.",
        "Give true details when you sign up and keep your password safe. You are responsible for what happens in your account.",
      ]} />

      <H2>3. Fair and legal use</H2>
      <p className="mt-2">You agree that you will:</p>
      <List items={[
        "Only scan websites you own, or that you are allowed to analyse, and follow each website's own terms and robots rules.",
        "Not use the service to attack, overload, hack, or find weak spots to exploit in any website.",
        "Not copy other people's designs, text, images, logos or code in a way that breaks copyright or trademark law. Reports are for learning and analysis.",
        "Not collect or misuse other people's personal data found on scanned pages.",
        "Not try to get around plan limits, rate limits or security, or use bots to call our servers.",
        "Not use the service for anything illegal under Indian law or the law where you live.",
      ]} />
      <p className="mt-2">We may block scans, limit, suspend or delete accounts that break these rules, with or without notice.</p>

      <H2>4. Plans and limits</H2>
      <p className="mt-2">Free accounts have usage limits shown on the Pricing page. Paid plans are not live yet; no payment is taken. If we start charging, we will show the price and terms before you pay. We can change limits or features at any time.</p>

      <H2>5. Your content</H2>
      <p className="mt-2">Reports, messages and shared links you create stay yours. You give us permission to store and show them only to run the service. When you share a report, anyone with the link can see it until you delete it.</p>

      <H2>6. Our content</H2>
      <p className="mt-2">The {SITE} app, design, logo and code belong to {OWNER}. Content of websites you scan belongs to their owners.</p>

      <H2>7. No warranty</H2>
      <p className="mt-2">The service is given &quot;as is&quot; and &quot;as available&quot;, free of charge, without any promise that it will be correct, complete, safe or always online. Read the <Link href="/disclaimer" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Disclaimer</Link> for details.</p>

      <H2>8. Limit of liability</H2>
      <p className="mt-2">As far as the law allows, {OWNER} is not responsible for any loss or damage (including lost data, profit or business) that comes from using or not being able to use {SITE}, or from acting on its reports. You agree to cover us against claims caused by your misuse of the service.</p>

      <H2>9. Ending use</H2>
      <p className="mt-2">You can stop using {SITE} any time and ask us to delete your account. We may stop or change the service at any time.</p>

      <H2>10. Changes to these terms</H2>
      <p className="mt-2">We may update these terms. The new version will be posted here with a new effective date. Using the service after that means you accept the new terms.</p>

      <H2>11. Law and disputes</H2>
      <p className="mt-2">These terms follow the laws of India. Any dispute will be handled by the courts of India. Please contact us first so we can try to solve it.</p>

      <H2>12. Contact</H2>
      <p className="mt-2">Questions? Use the <ContactLink /> page.</p>
    </LegalPage>
  );
}
