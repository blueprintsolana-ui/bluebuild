"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { ComputeBudgetProgram, Connection, Keypair, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import BN from "bn.js";
import { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount } from "@pump-fun/pump-sdk";
import { X } from "lucide-react";

import {
  LaunchpadError,
  confirmLaunch,
  fileToDataUrl,
  imageToLogoDataUrl,
  launchpadRpcFetch,
  launchpadRpcUrl,
  PENDING_LAUNCH_KEY,
  prepareLaunch,
  type LaunchForm,
  type LaunchedCoin,
} from "../lib/launchpad";

const LAMPORTS_PER_SOL = 1_000_000_000;
const CREATE_COMPUTE_UNITS = 150_000;
const BUY_COMPUTE_UNITS = 160_000;
const PRIORITY_MICRO_LAMPORTS = 250_000;
/** Rough reserve for pump.fun's creation cost, rent and network fees. */
const LAUNCH_COST_ESTIMATE_SOL = 0.03;

export type LaunchImageOption = { src: string; label: string };

type LaunchCoinDialogProps = {
  projectId: string;
  initialForm: LaunchForm;
  images: LaunchImageOption[];
  maxInitialBuySol: number;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onLaunched: (coin: LaunchedCoin) => void;
};

type Phase =
  | { step: "form" }
  | { step: "working"; message: string }
  | { step: "done"; coin: LaunchedCoin; buyNote: string | null };

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--forma-border)] bg-[var(--forma-page)] px-3 py-2 text-sm text-[var(--forma-text-strong)] outline-none transition placeholder:text-[var(--forma-text-muted)] focus:border-[rgb(var(--forma-cyan-rgb)/0.6)] disabled:opacity-60";
const labelClass = "block text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--forma-text-muted)]";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function solToLamports(value: number) {
  return new BN(Math.round(value * LAMPORTS_PER_SOL));
}

function withBudget(units: number, instructions: TransactionInstruction[]) {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICRO_LAMPORTS }),
    ...instructions,
  ];
}

async function waitForConfirmation(connection: Connection, signature: string, lastValidBlockHeight: number) {
  for (;;) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new LaunchpadError("The transaction failed on-chain. No coin was created.");
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    if ((await connection.getBlockHeight()) > lastValidBlockHeight) {
      throw new LaunchpadError("The network didn't confirm the transaction in time. Please try again.");
    }
    await sleep(1500);
  }
}

export default function LaunchCoinDialog(props: LaunchCoinDialogProps) {
  const { getToken } = props;
  const connectionConfig = useMemo(
    () => ({ commitment: "confirmed" as const, fetch: launchpadRpcFetch(getToken) }),
    [getToken],
  );
  const endpoint = useMemo(() => launchpadRpcUrl(), []);

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <WalletProvider wallets={[]} autoConnect={false}>
        <LaunchCoinDialogBody {...props} />
      </WalletProvider>
    </ConnectionProvider>
  );
}

function LaunchCoinDialogBody({ projectId, initialForm, images, maxInitialBuySol, getToken, onClose, onLaunched }: LaunchCoinDialogProps) {
  const { connection } = useConnection();
  const { wallets, wallet, select, connect, disconnect, connected, connecting, publicKey, signAllTransactions, signTransaction } = useWallet();
  const [form, setForm] = useState<LaunchForm>(initialForm);
  const [imageChoice, setImageChoice] = useState<string | null>(images[0]?.src || null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "form" });
  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const busy = phase.step === "working";

  const availableWallets = wallets.filter(
    (item) => item.readyState === WalletReadyState.Installed || item.readyState === WalletReadyState.Loadable,
  );
  const initialBuy = Number(form.initialBuySol || 0);
  const logoSrc = uploadedImage || imageChoice;

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase.step !== "working") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, phase.step]);

  useEffect(() => {
    if (wallet && !connected && !connecting) {
      connect().catch(() => setError("The wallet didn't connect. Open your wallet and try again."));
    }
  }, [wallet, connected, connecting, connect]);

  useEffect(() => {
    if (!publicKey) {
      setBalanceSol(null);
      return;
    }
    let cancelled = false;
    connection
      .getBalance(publicKey)
      .then((lamports) => !cancelled && setBalanceSol(lamports / LAMPORTS_PER_SOL))
      .catch(() => !cancelled && setBalanceSol(null));
    return () => {
      cancelled = true;
    };
  }, [connection, publicKey]);

  const update = (key: keyof LaunchForm) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const formProblem = useMemo(() => {
    if (!form.name.trim()) return "Give the coin a name.";
    if (!/^[A-Za-z0-9]{1,10}$/.test(form.symbol.trim().replace(/^\$/, ""))) return "The ticker must be 1 to 10 letters or numbers.";
    if (!Number.isFinite(initialBuy) || initialBuy < 0 || initialBuy > maxInitialBuySol) {
      return `The first buy must be between 0 and ${maxInitialBuySol} SOL.`;
    }
    if (!logoSrc) return "Choose a logo image.";
    if (!accepted) return "Tick the box to confirm you understand.";
    if (!publicKey) return "Connect your wallet.";
    if (balanceSol !== null && balanceSol < initialBuy + LAUNCH_COST_ESTIMATE_SOL) {
      return `Your wallet needs about ${(initialBuy + LAUNCH_COST_ESTIMATE_SOL).toFixed(2)} SOL for this launch.`;
    }
    return null;
  }, [accepted, balanceSol, form.name, form.symbol, initialBuy, logoSrc, maxInitialBuySol, publicKey]);

  const launch = useCallback(async () => {
    if (!publicKey || !logoSrc || formProblem) return;
    setError(null);
    try {
      setPhase({ step: "working", message: "Preparing your coin's logo and details…" });
      const token = await getToken();
      const mint = Keypair.generate();
      const imageData = await imageToLogoDataUrl(logoSrc);
      const prepared = await prepareLaunch(
        projectId,
        { ...form, symbol: form.symbol.trim().replace(/^\$/, "").toUpperCase() },
        { mint: mint.publicKey.toBase58(), creatorWallet: publicKey.toBase58(), imageData },
        token,
      );

      setPhase({ step: "working", message: "Building the pump.fun transaction…" });
      const common = {
        mint: mint.publicKey,
        name: prepared.name,
        symbol: prepared.symbol,
        uri: prepared.metadata_uri,
        creator: publicKey,
        user: publicKey,
        mayhemMode: false,
      };
      let createInstructions: TransactionInstruction[];
      let buyInstructions: TransactionInstruction[] = [];
      if (prepared.initial_buy_sol > 0) {
        const online = new OnlinePumpSdk(connection);
        const [global, feeConfig] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig()]);
        const solAmount = solToLamports(prepared.initial_buy_sol);
        const amount = getBuyTokenAmountFromSolAmount({
          global,
          feeConfig,
          mintSupply: null,
          bondingCurve: null,
          amount: solAmount,
          quoteMint: NATIVE_MINT,
        });
        // [create, create token account, buy]: too large for one transaction with our
        // metadata link, so the first buy goes in a second transaction right after.
        const instructions = await PUMP_SDK.createV2AndBuyInstructions({ ...common, global, amount, solAmount });
        createInstructions = instructions.slice(0, 1);
        buyInstructions = instructions.slice(1);
      } else {
        createInstructions = [await PUMP_SDK.createV2Instruction(common)];
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const createTx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight }).add(
        ...withBudget(CREATE_COMPUTE_UNITS, createInstructions),
      );
      createTx.partialSign(mint);
      const transactions = [createTx];
      if (buyInstructions.length) {
        transactions.push(
          new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight }).add(
            ...withBudget(BUY_COMPUTE_UNITS, buyInstructions),
          ),
        );
      }

      setPhase({ step: "working", message: "Approve the launch in your wallet…" });
      const signed = signAllTransactions
        ? await signAllTransactions(transactions)
        : await Promise.all(transactions.map((transaction) => signTransaction!(transaction)));

      setPhase({ step: "working", message: "Launching on pump.fun…" });
      const createSignature = await connection.sendRawTransaction(signed[0].serialize(), { maxRetries: 5 });
      try {
        window.localStorage.setItem(
          PENDING_LAUNCH_KEY,
          JSON.stringify({ projectId, launchId: prepared.launch_id, signature: createSignature }),
        );
      } catch {
        // Resuming after a refresh is a convenience only.
      }
      await waitForConfirmation(connection, createSignature, lastValidBlockHeight);

      let buyNote: string | null = null;
      if (signed[1]) {
        setPhase({ step: "working", message: "Coin created. Placing your first buy…" });
        try {
          const buySignature = await connection.sendRawTransaction(signed[1].serialize(), { maxRetries: 5 });
          await waitForConfirmation(connection, buySignature, lastValidBlockHeight);
          buyNote = `Your first buy of ${prepared.initial_buy_sol} SOL went through.`;
        } catch {
          buyNote = "Your coin is live, but the first buy didn't go through (the price may have moved). You can buy on pump.fun.";
        }
      }

      setPhase({ step: "working", message: "Recording your coin on Bluebuild…" });
      let coin: LaunchedCoin | undefined;
      for (let attempt = 0; attempt < 12 && !coin; attempt += 1) {
        const result = await confirmLaunch(prepared.launch_id, createSignature, await getToken());
        if (result.status === "launched") coin = result.launch;
        else await sleep(2500);
      }
      if (!coin) {
        throw new LaunchpadError(
          "Your coin is live on pump.fun, but Bluebuild couldn't record it yet. Reload this page in a minute and it will finish.",
        );
      }
      try {
        window.localStorage.removeItem(PENDING_LAUNCH_KEY);
      } catch {
        // Ignore storage failures.
      }
      setPhase({ step: "done", coin, buyNote });
      onLaunched(coin);
    } catch (caught) {
      const message =
        caught instanceof LaunchpadError
          ? caught.message
          : /reject|cancel|denied/i.test(String((caught as Error)?.message || caught))
            ? "You cancelled the request in your wallet. Nothing was launched."
            : "The launch didn't go through. Nothing was charged unless your wallet shows a completed transaction.";
      setError(message);
      setPhase({ step: "form" });
    }
  }, [connection, form, formProblem, getToken, logoSrc, onLaunched, projectId, publicKey, signAllTransactions, signTransaction]);

  const body = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Launch a coin"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-[var(--forma-border)] bg-[var(--forma-surface)] text-[var(--forma-text)] shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--forma-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--forma-text-strong)]">Launch a coin for this design</h2>
            <p className="mt-0.5 text-xs text-[var(--forma-text-muted)]">Created on pump.fun from your own wallet.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--forma-border)] text-[var(--forma-text-muted)] transition hover:text-[var(--forma-text-strong)] disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {phase.step === "done" ? (
          <div className="overflow-y-auto px-5 py-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote coin logo */}
            <img src={phase.coin.image_url} alt="" className="mx-auto h-20 w-20 rounded-xl border border-[var(--forma-border)] object-cover" />
            <h3 className="mt-4 text-lg font-semibold text-[var(--forma-text-strong)]">
              {phase.coin.name} <span className="text-[var(--forma-text-muted)]">${phase.coin.symbol}</span> is live
            </h3>
            {phase.buyNote && <p className="mt-2 text-sm text-[var(--forma-text-secondary)]">{phase.buyNote}</p>}
            <p className="mt-2 break-all font-mono text-[11px] text-[var(--forma-text-muted)]">{phase.coin.mint}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <a href={phase.coin.pump_url} target="_blank" rel="noreferrer" className="connect-wallet-button">
                View on pump.fun
              </a>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center rounded-lg border border-[var(--forma-border)] px-4 text-sm font-medium text-[var(--forma-text-strong)]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5">
              <section aria-label="Wallet">
                <div className={labelClass}>1. Wallet</div>
                {publicKey ? (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--forma-border)] bg-[var(--forma-page)] px-3 py-2 text-sm">
                    <span className="font-mono text-xs text-[var(--forma-text-strong)]">
                      {wallet?.adapter.name}: {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
                      {balanceSol !== null && <span className="ml-2 text-[var(--forma-text-muted)]">{balanceSol.toFixed(3)} SOL</span>}
                    </span>
                    <button type="button" disabled={busy} onClick={() => void disconnect()} className="text-xs text-[var(--forma-text-muted)] underline">
                      Change
                    </button>
                  </div>
                ) : availableWallets.length ? (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {availableWallets.map((item) => (
                      <button
                        key={item.adapter.name}
                        type="button"
                        disabled={connecting}
                        onClick={() => {
                          setError(null);
                          select(item.adapter.name);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--forma-border)] bg-[var(--forma-page)] px-3 py-2 text-sm font-medium text-[var(--forma-text-strong)] transition hover:border-[var(--forma-text-muted)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- wallet-provided icon */}
                        <img src={item.adapter.icon} alt="" className="h-5 w-5" />
                        {item.adapter.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-[var(--forma-text-secondary)]">
                    No Solana wallet found in this browser. Install{" "}
                    <a href="https://phantom.com/download" target="_blank" rel="noreferrer" className="underline">Phantom</a> or{" "}
                    <a href="https://solflare.com/download" target="_blank" rel="noreferrer" className="underline">Solflare</a>, then reopen this form.
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-[var(--forma-text-muted)]">Use the same wallet you signed in to Bluebuild with.</p>
              </section>

              <section aria-label="Coin details" className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <label className={labelClass}>
                  2. Coin name
                  <input className={inputClass} value={form.name} maxLength={32} onChange={update("name")} disabled={busy} />
                </label>
                <label className={labelClass}>
                  Ticker
                  <input
                    className={`${inputClass} uppercase`}
                    value={form.symbol}
                    maxLength={10}
                    onChange={update("symbol")}
                    disabled={busy}
                  />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Description
                  <textarea
                    className={`${inputClass} min-h-[72px] resize-y`}
                    value={form.description}
                    maxLength={500}
                    onChange={update("description")}
                    disabled={busy}
                  />
                </label>
              </section>

              <section aria-label="Logo">
                <div className={labelClass}>3. Logo</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {images.slice(0, 4).map((image) => {
                    const selected = !uploadedImage && imageChoice === image.src;
                    return (
                      <button
                        key={image.src}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setUploadedImage(null);
                          setImageChoice(image.src);
                        }}
                        title={image.label}
                        aria-pressed={selected}
                        className={`h-16 w-16 overflow-hidden rounded-lg border-2 transition ${selected ? "border-[#ffb547]" : "border-transparent opacity-70 hover:opacity-100"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- design image */}
                        <img src={image.src} alt={image.label} className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                  <label className={`flex h-16 w-16 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-[10px] text-[var(--forma-text-muted)] ${uploadedImage ? "border-[#ffb547]" : "border-[var(--forma-border)]"}`}>
                    {uploadedImage ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local upload preview
                      <img src={uploadedImage} alt="Uploaded logo" className="h-full w-full object-cover" />
                    ) : (
                      "Upload"
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      disabled={busy}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          setUploadedImage(await fileToDataUrl(file));
                        } catch (caught) {
                          setError((caught as Error).message);
                        }
                      }}
                    />
                  </label>
                </div>
              </section>

              <section aria-label="Links" className="grid gap-3 sm:grid-cols-3">
                <label className={labelClass}>
                  4. Website <span className="normal-case tracking-normal">(optional)</span>
                  <input className={inputClass} value={form.website} onChange={update("website")} placeholder="https://" disabled={busy} />
                </label>
                <label className={labelClass}>
                  X / Twitter <span className="normal-case tracking-normal">(optional)</span>
                  <input className={inputClass} value={form.twitter} onChange={update("twitter")} placeholder="@handle" disabled={busy} />
                </label>
                <label className={labelClass}>
                  Telegram <span className="normal-case tracking-normal">(optional)</span>
                  <input className={inputClass} value={form.telegram} onChange={update("telegram")} placeholder="t.me/group" disabled={busy} />
                </label>
              </section>

              <section aria-label="First buy">
                <label className={labelClass}>
                  5. Your first buy in SOL <span className="normal-case tracking-normal">(optional)</span>
                  <input
                    className={inputClass}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={maxInitialBuySol}
                    step="0.01"
                    value={form.initialBuySol}
                    onChange={update("initialBuySol")}
                    disabled={busy}
                  />
                </label>
                <p className="mt-1.5 text-[11px] text-[var(--forma-text-muted)]">
                  You pay pump.fun&apos;s small creation and network fees (about {LAUNCH_COST_ESTIMATE_SOL} SOL) plus any first buy. Bluebuild takes no fee.
                </p>
              </section>

              <label className="flex items-start gap-2.5 rounded-lg border border-[var(--forma-border)] bg-[var(--forma-page)] p-3 text-xs leading-5 text-[var(--forma-text-secondary)]">
                <input type="checkbox" className="mt-0.5" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy} />
                <span>
                  I&apos;m creating this coin myself, from my own wallet, on pump.fun. Bluebuild doesn&apos;t endorse or promote it, takes no fee,
                  and can&apos;t undo, change or refund anything. Coins can lose all their value.
                </span>
              </label>

              {error && (
                <div role="alert" className="rounded-lg border border-[rgb(var(--forma-red-rgb)/0.35)] bg-[rgb(var(--forma-red-rgb)/0.08)] px-3 py-2 text-xs text-[rgb(var(--forma-red-rgb))]">
                  {error}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-[var(--forma-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--forma-text-muted)]" aria-live="polite">
                {phase.step === "working" ? phase.message : formProblem || "Ready to launch."}
              </p>
              <button
                type="button"
                onClick={() => void launch()}
                disabled={Boolean(formProblem) || busy}
                className="connect-wallet-button justify-center disabled:cursor-not-allowed disabled:opacity-50 disabled:[animation:none]"
              >
                {busy ? "Launching…" : "Launch coin"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
