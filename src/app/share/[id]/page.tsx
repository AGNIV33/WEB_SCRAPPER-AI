"use client";

import dynamic from "next/dynamic";

// Public read-only report page. Rendered only in the browser (data comes from Firestore).
const SharedReport = dynamic(() => import("@/components/SharedReport"), { ssr: false });

export default function SharePage() {
  return <SharedReport />;
}
