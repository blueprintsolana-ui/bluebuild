import { notFound } from "next/navigation";

import CraftKitShowcase from "./craft-kit-showcase";

/** Local-only test sheet for the craft kit (BLUEBUILD_DESIGN_BRIEF.md, "How to work" step 1). */
export default function CraftKitPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CraftKitShowcase />;
}
