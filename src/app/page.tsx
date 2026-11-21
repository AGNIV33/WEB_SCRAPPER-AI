"use client";

import dynamic from "next/dynamic";

// Rendered only in the browser. This avoids hydration warnings caused by
// browser extensions that inject attributes into the server HTML.
const App = dynamic(() => import("@/components/App"), { ssr: false });

export default function Page() {
  return <App />;
}