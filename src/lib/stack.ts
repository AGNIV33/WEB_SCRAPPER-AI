/**
 * Tech stack detector (server side): looks at the home page HTML, response headers and cookies.
 * Free, no API. Complements the in-browser checks in extractScript.ts.
 */
import type { StackItem } from "./insights";

type Rule = {
  name: string; category: string;
  html?: RegExp; header?: [string, RegExp]; cookie?: RegExp; meta?: RegExp; // meta = generator tag
  version?: RegExp; // run on html; first group = version
};

const R: Rule[] = [
  // CMS / site builders
  { name: "WordPress", category: "CMS", html: /\/wp-(?:content|includes)\//, meta: /WordPress/i },
  { name: "Drupal", category: "CMS", html: /Drupal\.settings|\/sites\/default\/files\//, header: ["x-generator", /Drupal/i], meta: /Drupal/i },
  { name: "Joomla", category: "CMS", meta: /Joomla/i, html: /\/media\/jui\// },
  { name: "Ghost", category: "CMS", meta: /Ghost/i },
  { name: "Contentful", category: "CMS", html: /ctfassets\.net/ },
  { name: "Sanity", category: "CMS", html: /cdn\.sanity\.io/ },
  { name: "Strapi", category: "CMS", html: /strapi/i, header: ["x-powered-by", /Strapi/i] },
  { name: "Prismic", category: "CMS", html: /images\.prismic\.io|prismic\.io\/api/ },
  { name: "Storyblok", category: "CMS", html: /a\.storyblok\.com/ },
  { name: "HubSpot CMS", category: "CMS", header: ["x-hs-cache-config", /./] },
  { name: "Webflow", category: "Site builder", html: /data-wf-page|assets\.website-files\.com|webflow\.com\/css/ },
  { name: "Wix", category: "Site builder", html: /static\.wixstatic\.com|wix-bolt/, header: ["x-wix-request-id", /./] },
  { name: "Squarespace", category: "Site builder", html: /static1\.squarespace\.com|squarespace-cdn/ },
  { name: "Framer", category: "Site builder", html: /framerusercontent\.com|framer\.com\/m\// },
  { name: "Carrd", category: "Site builder", html: /carrd\.co/ },
  { name: "Notion (Super/Potion)", category: "Site builder", html: /super\.so|potion\.so/ },
  // E-commerce
  { name: "Shopify", category: "E-commerce", html: /cdn\.shopify\.com|Shopify\.theme/, header: ["x-shopid", /./] },
  { name: "WooCommerce", category: "E-commerce", html: /woocommerce/i },
  { name: "Magento", category: "E-commerce", html: /Mage\.Cookies|\/static\/version\d+\/frontend\//, cookie: /\bX-Magento-Vary\b/i },
  { name: "BigCommerce", category: "E-commerce", html: /cdn\d*\.bigcommerce\.com/ },
  { name: "PrestaShop", category: "E-commerce", meta: /PrestaShop/i, cookie: /PrestaShop-/ },
  { name: "Ecwid", category: "E-commerce", html: /app\.ecwid\.com/ },
  // Frameworks
  { name: "Next.js", category: "Framework", html: /\/_next\/static\/|__NEXT_DATA__/, header: ["x-powered-by", /Next\.js/i] },
  { name: "Nuxt", category: "Framework", html: /\/_nuxt\/|__NUXT__/ },
  { name: "Gatsby", category: "Framework", html: /___gatsby/, meta: /Gatsby/i },
  { name: "Astro", category: "Framework", html: /astro-island|data-astro-cid/, meta: /Astro/i },
  { name: "SvelteKit", category: "Framework", html: /__sveltekit|\/_app\/immutable\// },
  { name: "Remix", category: "Framework", html: /__remixContext/ },
  { name: "Angular", category: "Framework", html: /ng-version="/, version: /ng-version="([\d.]+)"/ },
  { name: "Hugo", category: "Static site generator", meta: /Hugo/i },
  { name: "Jekyll", category: "Static site generator", meta: /Jekyll/i },
  { name: "Docusaurus", category: "Static site generator", meta: /Docusaurus/i },
  { name: "Laravel", category: "Back-end", cookie: /laravel_session/ },
  { name: "Django", category: "Back-end", cookie: /\bcsrftoken=/, html: /csrfmiddlewaretoken/ },
  { name: "Ruby on Rails", category: "Back-end", html: /csrf-param" content="authenticity_token"/ },
  { name: "ASP.NET", category: "Back-end", header: ["x-powered-by", /ASP\.NET/i], cookie: /ASP\.NET_SessionId|\.AspNetCore\./ },
  { name: "PHP", category: "Back-end", header: ["x-powered-by", /PHP/i], cookie: /PHPSESSID/ },
  { name: "Express", category: "Back-end", header: ["x-powered-by", /Express/i] },
  { name: "Java (JSESSIONID)", category: "Back-end", cookie: /JSESSIONID/ },
  // Hosting / CDN / server
  { name: "Cloudflare", category: "CDN / Hosting", header: ["cf-ray", /./] },
  { name: "Vercel", category: "CDN / Hosting", header: ["x-vercel-id", /./] },
  { name: "Netlify", category: "CDN / Hosting", header: ["x-nf-request-id", /./] },
  { name: "AWS CloudFront", category: "CDN / Hosting", header: ["x-amz-cf-id", /./] },
  { name: "Amazon S3", category: "CDN / Hosting", header: ["server", /AmazonS3/i] },
  { name: "Fastly", category: "CDN / Hosting", header: ["x-served-by", /cache-/] },
  { name: "Akamai", category: "CDN / Hosting", header: ["server", /AkamaiGHost/i] },
  { name: "GitHub Pages", category: "CDN / Hosting", header: ["x-github-request-id", /./] },
  { name: "Google Cloud", category: "CDN / Hosting", header: ["via", /google/i] },
  { name: "Azure", category: "CDN / Hosting", header: ["x-azure-ref", /./] },
  { name: "Firebase Hosting", category: "CDN / Hosting", header: ["x-firebase-hosting", /./] },
  { name: "Render", category: "CDN / Hosting", header: ["x-render-origin-server", /./] },
  { name: "Fly.io", category: "CDN / Hosting", header: ["fly-request-id", /./] },
  { name: "Heroku", category: "CDN / Hosting", header: ["via", /vegur/i] },
  { name: "Nginx", category: "Web server", header: ["server", /nginx/i] },
  { name: "Apache", category: "Web server", header: ["server", /Apache/i] },
  { name: "LiteSpeed", category: "Web server", header: ["server", /LiteSpeed/i] },
  { name: "Microsoft IIS", category: "Web server", header: ["server", /IIS/i] },
  { name: "Caddy", category: "Web server", header: ["server", /Caddy/i] },
  // JS libraries / UI
  { name: "jQuery", category: "JavaScript library", html: /jquery[.-]?(\d[\d.]*)?(\.min)?\.js/i, version: /jquery[.-](\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i },
  { name: "Bootstrap", category: "UI framework", html: /bootstrap(\.min)?\.(css|js)/i, version: /bootstrap[@/-](\d+\.\d+(?:\.\d+)?)/i },
  { name: "Tailwind CSS", category: "UI framework", html: /tailwindcss|class="[^"]*\b(?:px|py|mt|mb)-\d[^"]*\b(?:text|bg)-(?:gray|slate|zinc)-\d{3}/ },
  { name: "Alpine.js", category: "JavaScript library", html: /alpinejs|x-data="/ },
  { name: "htmx", category: "JavaScript library", html: /htmx\.org|hx-get="|hx-post="/ },
  { name: "GSAP", category: "JavaScript library", html: /gsap(\.min)?\.js|greensock/i },
  { name: "Three.js", category: "JavaScript library", html: /three(\.module)?(\.min)?\.js/i },
  { name: "Swiper", category: "JavaScript library", html: /swiper(-bundle)?(\.min)?\.(js|css)/i },
  { name: "Lottie", category: "JavaScript library", html: /lottie(-player|\.min)?\.js|lottiefiles/i },
  { name: "Font Awesome", category: "Fonts / icons", html: /font-?awesome|kit\.fontawesome\.com/i },
  { name: "Google Fonts", category: "Fonts / icons", html: /fonts\.googleapis\.com|fonts\.gstatic\.com/ },
  { name: "Adobe Fonts", category: "Fonts / icons", html: /use\.typekit\.net/ },
  // Analytics / marketing / tags
  { name: "Google Analytics", category: "Analytics", html: /google-analytics\.com|gtag\/js\?id=G-|gtag\('config'/ },
  { name: "Google Tag Manager", category: "Tag manager", html: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/ },
  { name: "Plausible", category: "Analytics", html: /plausible\.io\/js/ },
  { name: "Fathom", category: "Analytics", html: /cdn\.usefathom\.com/ },
  { name: "Matomo", category: "Analytics", html: /matomo\.js|piwik\.js/ },
  { name: "Mixpanel", category: "Analytics", html: /cdn\.mxpnl\.com|mixpanel/i },
  { name: "Amplitude", category: "Analytics", html: /cdn\.amplitude\.com/ },
  { name: "Segment", category: "Analytics", html: /cdn\.segment\.com/ },
  { name: "PostHog", category: "Analytics", html: /posthog/i },
  { name: "Heap", category: "Analytics", html: /heap-?analytics|cdn\.heapanalytics\.com/ },
  { name: "Hotjar", category: "Analytics", html: /static\.hotjar\.com/ },
  { name: "Microsoft Clarity", category: "Analytics", html: /clarity\.ms\/tag/ },
  { name: "Vercel Analytics", category: "Analytics", html: /\/_vercel\/insights/ },
  { name: "Meta Pixel", category: "Advertising", html: /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\('init'/ },
  { name: "LinkedIn Insight", category: "Advertising", html: /snap\.licdn\.com/ },
  { name: "TikTok Pixel", category: "Advertising", html: /analytics\.tiktok\.com/ },
  { name: "Google Ads", category: "Advertising", html: /googleadservices\.com|AW-\d{6,}/ },
  { name: "Google AdSense", category: "Advertising", html: /pagead2\.googlesyndication\.com/ },
  { name: "HubSpot", category: "Marketing", html: /js\.hs-scripts\.com|js\.hsforms\.net|hs-analytics/ },
  { name: "Mailchimp", category: "Marketing", html: /list-manage\.com|chimpstatic\.com/ },
  { name: "Klaviyo", category: "Marketing", html: /static\.klaviyo\.com/ },
  { name: "Optimizely", category: "A/B testing", html: /cdn\.optimizely\.com/ },
  { name: "VWO", category: "A/B testing", html: /dev\.visualwebsiteoptimizer\.com/ },
  // Support / chat
  { name: "Intercom", category: "Chat / support", html: /widget\.intercom\.io|intercomSettings/ },
  { name: "Drift", category: "Chat / support", html: /js\.driftt\.com/ },
  { name: "Crisp", category: "Chat / support", html: /client\.crisp\.chat/ },
  { name: "Tawk.to", category: "Chat / support", html: /embed\.tawk\.to/ },
  { name: "Zendesk", category: "Chat / support", html: /static\.zdassets\.com|zopim/ },
  { name: "Tidio", category: "Chat / support", html: /code\.tidio\.co/ },
  { name: "LiveChat", category: "Chat / support", html: /cdn\.livechatinc\.com/ },
  // Payments
  { name: "Stripe", category: "Payments", html: /js\.stripe\.com/ },
  { name: "PayPal", category: "Payments", html: /paypal\.com\/sdk|paypalobjects\.com/ },
  { name: "Razorpay", category: "Payments", html: /checkout\.razorpay\.com/ },
  { name: "Paddle", category: "Payments", html: /cdn\.paddle\.com/ },
  { name: "Lemon Squeezy", category: "Payments", html: /lemonsqueezy\.com/ },
  // Security / consent / misc
  { name: "reCAPTCHA", category: "Security", html: /google\.com\/recaptcha|recaptcha\/api\.js/ },
  { name: "hCaptcha", category: "Security", html: /hcaptcha\.com\/1\/api\.js/ },
  { name: "Cloudflare Turnstile", category: "Security", html: /challenges\.cloudflare\.com\/turnstile/ },
  { name: "Cookiebot", category: "Cookie consent", html: /consent\.cookiebot\.com/ },
  { name: "OneTrust", category: "Cookie consent", html: /cdn\.cookielaw\.org|onetrust/i },
  { name: "Osano", category: "Cookie consent", html: /cmp\.osano\.com/ },
  { name: "YouTube embed", category: "Video", html: /youtube(-nocookie)?\.com\/embed/ },
  { name: "Vimeo", category: "Video", html: /player\.vimeo\.com/ },
  { name: "Wistia", category: "Video", html: /fast\.wistia\.(com|net)/ },
  { name: "Google Maps", category: "Maps", html: /maps\.googleapis\.com|google\.com\/maps\/embed/ },
  { name: "Mapbox", category: "Maps", html: /api\.mapbox\.com/ },
  { name: "Typeform", category: "Forms", html: /embed\.typeform\.com/ },
  { name: "Calendly", category: "Scheduling", html: /assets\.calendly\.com/ },
  { name: "Algolia", category: "Search", html: /algolia(net)?\.(com|net)|algoliasearch/ },
  { name: "Sentry", category: "Monitoring", html: /browser\.sentry-cdn\.com|sentry\.io/ },
  { name: "New Relic", category: "Monitoring", html: /js-agent\.newrelic\.com|NREUM/ },
  { name: "Firebase", category: "Back-end service", html: /firebaseapp\.com|gstatic\.com\/firebasejs/ },
  { name: "Supabase", category: "Back-end service", html: /\.supabase\.co/ },
  { name: "Cloudinary", category: "Media CDN", html: /res\.cloudinary\.com/ },
  { name: "imgix", category: "Media CDN", html: /\.imgix\.net/ },
  { name: "jsDelivr", category: "Media CDN", html: /cdn\.jsdelivr\.net/ },
  { name: "unpkg", category: "Media CDN", html: /unpkg\.com\// },
  { name: "cdnjs", category: "Media CDN", html: /cdnjs\.cloudflare\.com/ },
  { name: "PWA (web app manifest)", category: "Other", html: /rel=["']manifest["']/ },
  { name: "AMP", category: "Other", html: /<html[^>]+(?:⚡|\bamp\b)/ },
];

/** Category for names found by the in-browser check (so both lists can be shown together). */
const BROWSER_CATS: Record<string, string> = {
  "React": "JavaScript library", "Vue": "Framework", "AngularJS": "Framework", "Svelte": "Framework", "jQuery UI": "JavaScript library",
  "Lodash": "JavaScript library", "Moment.js": "JavaScript library", "Handlebars": "JavaScript library", "Framer (site builder)": "Site builder",
  "Stripe.js": "Payments", "Meta Pixel": "Advertising",
};
export const categoryOf = (name: string) => BROWSER_CATS[name] || R.find((r) => r.name === name)?.category || "Other";

export function detectStack(html: string, headers: Record<string, string>): StackItem[] {
  const out = new Map<string, StackItem>();
  const cookies = headers["set-cookie"] || "";
  const gen = (html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']generator["']/i))?.[1] || headers["x-generator"] || "";
  const h = html.slice(0, 1_500_000);
  for (const r of R) {
    let how = "";
    if (r.header && headers[r.header[0]] && r.header[1].test(headers[r.header[0]])) how = `header ${r.header[0]}`;
    else if (r.meta && gen && r.meta.test(gen)) how = "generator tag";
    else if (r.cookie && r.cookie.test(cookies)) how = "cookie";
    else if (r.html && r.html.test(h)) how = "page code";
    if (!how) continue;
    let version: string | null = null;
    if (r.version) version = h.match(r.version)?.[1] || null;
    if (!version && how === "generator tag") version = gen.match(/(\d+(?:\.\d+)+)/)?.[1] || null;
    if (!version && r.header && headers[r.header[0]]) version = headers[r.header[0]].match(/\/(\d+(?:\.\d+)+)/)?.[1] || null;
    out.set(r.name, { name: r.name, category: r.category, version, how });
  }
  return [...out.values()];
}
