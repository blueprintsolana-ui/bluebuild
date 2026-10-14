import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { formaAuthMode } from "../lib/auth-mode";
import { FormaAuthProvider } from "../lib/forma-auth";
import { BluebuildQuotaBadge } from "../components/bluebuild-quota-badge";
import { themeBootstrapScript } from "../lib/theme";
import { ThemeProvider } from "../lib/theme-provider";
import "./globals.css";
import "./craft.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bluebuild | Describe it. We'll draw the build.",
  description: "Upload an image or describe an idea to generate parts, wiring, cost, and assembly notes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authMode = formaAuthMode();
  const document = (
    <html lang="en" data-theme="solarized-dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body data-auth-mode={authMode} data-auth-required={authMode === "clerk" ? "true" : "false"}>
        <ThemeProvider>
          <FormaAuthProvider mode={authMode}>
            {children}
            <BluebuildQuotaBadge />
          </FormaAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
  return authMode === "clerk" ? <ClerkProvider>{document}</ClerkProvider> : document;
}
