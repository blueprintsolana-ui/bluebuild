import { LANDING_HTML } from "./landing-html";

export const dynamic = "force-static";

/** "/" shows the Bluebuild landing page; the app itself lives at /app. */
export function GET() {
  return new Response(LANDING_HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
