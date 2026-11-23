import type { Metadata } from "next";
import LegalPage, { ContactLink, H2, List, OWNER, SITE } from "@/components/LegalPage";

export const metadata: Metadata = { title: `Privacy Policy · ${SITE}`, description: `How ${SITE} collects, uses and protects your data.` };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" current="/privacy">
      <p className="mt-4">{SITE} (&quot;we&quot;, &quot;us&quot;) is a website analyzer run by {OWNER} in India. This policy explains, in simple words, what data we collect, why, who we share it with, and the choices you have. By using {SITE} you agree to this policy.</p>

      <H2>1. What we collect</H2>
      <p className="mt-2"><b>If you use the app without an account (guest):</b></p>
      <List items={[
        "The website address (URL) you type in, so we can scan it. Guest scans are not saved on our servers.",
        "Your IP address, used for a short time to stop abuse (rate limiting). It is kept only for the length of the limit window (minutes to a day) and then deleted.",
      ]} />
      <p className="mt-3"><b>If you create an account:</b></p>
      <List items={[
        "Account details: your email address, name and, if you sign in with Google, your Google profile photo link. Passwords are handled by Google Firebase; we never see or store them.",
        "Profile: the country you choose.",
        "Scan history: the reports of sites you scan (URL, scores, colours, fonts, page details, AI suggestions). Screenshots are not saved.",
        "Shared reports: if you press Share, a read-only copy of that report is saved so anyone with the link can open it.",
        "Usage data: sign-in count, last seen time, time spent in the app (counted per minute while the app is open), and a record of each scan or error (website host, number of pages, time taken, short error text). This shows in our private admin dashboard so we can improve the service and stop abuse.",
        "Free plan counters: how many sites and scans you have used.",
        "Messages you send through Contact us: your email, name, the message, which screen you were on, and your browser type (user agent).",
      ]} />
      <p className="mt-3">We do <b>not</b> collect payment details (online payment is not switched on), and we do <b>not</b> use advertising or tracking cookies.</p>

      <H2>2. Data from websites you scan</H2>
      <p className="mt-2">When you scan a website, our servers visit its public pages like a normal browser and read what any visitor can see (HTML, styles, headers, images, links). We do not log in, fill forms or try to break in. If a scanned page shows personal data of other people in public, it may appear in your report. You are responsible for how you use those reports.</p>

      <H2>3. Why we use your data</H2>
      <List items={[
        "To run scans and show you reports.",
        "To save your history and let you share reports (only if you have an account).",
        "To apply free plan limits and stop spam or abuse.",
        "To answer your messages and fix problems.",
        "To understand how the app is used and make it better.",
      ]} />
      <p className="mt-2">We use your data based on your consent (when you sign up or press a button like Share or Send) and to provide the service you asked for. You can withdraw consent at any time by deleting your data or asking us to delete your account.</p>

      <H2>4. Services we share data with</H2>
      <p className="mt-2">We do not sell your data. To make the app work, some data goes to these providers:</p>
      <List items={[
        <><b>Vercel</b> (hosting): runs the website; may keep standard server logs such as IP address and request time.</>,
        <><b>Google Firebase</b> (login and database): stores your account, profile, history, shares and messages.</>,
        <><b>NVIDIA NIM</b> (AI): the report data of a scanned site, and your questions in &quot;Ask AI&quot;, are sent to create suggestions, design.md and answers.</>,
        <><b>Google Gemini API, free tier</b> (competitor finder): the scanned site&apos;s address and short summary are sent. On the free tier, Google says it may use this data to improve its products, and people may review it. Do not use this feature for anything private.</>,
        <><b>Google PageSpeed Insights and Google Safe Browsing</b>: the scanned site&apos;s address is sent to check speed and safety.</>,
        <><b>rdap.org and The Green Web Foundation</b>: the scanned site&apos;s domain name is sent to check domain age and green hosting.</>,
        <><b>Google Fonts</b>: your browser may load fonts from Google to show a scanned site&apos;s fonts, which shares your IP address with Google.</>,
        <><b>Upstash</b> (if enabled): stores short-lived rate limit counters keyed by IP address.</>,
      ]} />
      <p className="mt-2">These providers may store data on servers outside India. Each has its own privacy policy.</p>

      <H2>5. Cookies and local storage</H2>
      <p className="mt-2">We do not use advertising or analytics cookies. Your browser&apos;s local storage keeps your settings (theme, glass mode, motion), in-app notifications, tour and profile-form status, and your login session (kept by Firebase). You can clear these any time in your browser settings.</p>

      <H2>6. How long we keep data</H2>
      <List items={[
        "Account, profile and history: until you delete them or ask us to delete your account.",
        "Shared report links: until you delete the share.",
        "Usage records and messages: as long as needed to run and improve the service, then deleted when your account is deleted, unless the law asks us to keep them.",
        "Rate limit data: minutes to one day.",
      ]} />

      <H2>7. Your rights</H2>
      <p className="mt-2">Under India&apos;s Digital Personal Data Protection Act, 2023 (and similar laws such as the GDPR, where they apply), you can:</p>
      <List items={[
        "See what personal data we hold about you.",
        "Correct or update it (you can edit your name and country in your profile).",
        "Delete it: delete reports from History yourself, or ask us to delete your whole account.",
        "Withdraw consent and stop using the service.",
        "Name someone to act for you if you die or cannot act.",
        "Complain to us first, and if not solved, to the Data Protection Board of India (or your local data authority).",
      ]} />
      <p className="mt-2">To use any right, write to us through the <ContactLink /> page (you need to be logged in). We aim to reply within 30 days.</p>

      <H2>8. Security</H2>
      <p className="mt-2">Data is sent over HTTPS. Database rules let each user read only their own data, and only the admin can see usage and messages. No system is 100% safe, so please use a strong password and do not reuse it.</p>

      <H2>9. Children</H2>
      <p className="mt-2">{SITE} is not meant for children. You must be 18 or older to create an account. If you think a child has given us data, contact us and we will delete it.</p>

      <H2>10. Changes</H2>
      <p className="mt-2">We may update this policy. The new version will be posted here with a new effective date. For big changes we will also try to tell you inside the app.</p>

      <H2>11. Contact (Grievance Officer)</H2>
      <p className="mt-2">{OWNER}, owner of {SITE}, India. Reach us through the <ContactLink /> page.</p>
    </LegalPage>
  );
}
