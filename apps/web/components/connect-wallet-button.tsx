"use client";

import { Wallet } from "lucide-react";
import { useFormaAuth } from "../lib/forma-auth";

/** Prominent top-right call to action shown while the visitor has no wallet connected. */
export function ConnectWalletButton() {
  const { authRequired, isLoaded, isSignedIn, openSignIn } = useFormaAuth();
  if (!authRequired || !isLoaded || isSignedIn) return null;

  return (
    <button
      type="button"
      onClick={() => openSignIn({ redirectUrl: typeof window !== "undefined" ? window.location.href : "/" })}
      className="connect-wallet-button"
      title="Connect a Solana wallet to get free designs every day"
    >
      <Wallet className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
      <span>Connect wallet</span>
    </button>
  );
}
