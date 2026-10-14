import type { Metadata } from "next";

import LandingPage from "../components/landing/landing-page";
import "./landing.css";

export const metadata: Metadata = {
  title: "Bluebuild — Describe it. We'll draw the build. Then launch it.",
  description:
    "Type one sentence. Bluebuild returns a parts list, wiring diagram, 3D model and build guide for your product idea, then lets you launch a pump.fun coin for it with its own pitch deck. Open source.",
  openGraph: {
    title: "Bluebuild — Describe it. We'll draw the build. Then launch it.",
    description:
      "Open-source AI hardware design and launchpad. Parts, wiring, 3D model and build steps from one sentence, plus a pump.fun coin and pitch deck for your idea.",
  },
  twitter: { card: "summary_large_image", site: "@bluebuild_AI" },
};

/** "/" is the landing page; the app lives at /app. */
export default function Home() {
  return <LandingPage />;
}
