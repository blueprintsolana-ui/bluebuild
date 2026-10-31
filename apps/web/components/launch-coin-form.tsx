"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { ComputeBudgetProgram, Connection, Keypair, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import BN from "bn.js";
import { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount } from "@pump-fun/pump-sdk";

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
import { PitchDeckPreview, type LaunchImageOption, type LaunchPreview } from "./pitch-deck-preview";

export type { LaunchImageOption, LaunchPreview };

const LAMPORTS_PER_SOL = 1_000_000_000;
const CREATE_COMPUTE_UNITS = 150_000;
const BUY_COMPUTE_UNITS = 160_000;
const PRIORITY_MICRO_LAMPORTS = 250_000;
/** Rough reserve for pump.fun's creation cost, rent and network fees. */
const LAUNCH_COST_ESTIMATE_SOL = 0.03;

type LaunchCoinFormProps = {
  projectId: string;
  initialForm: LaunchForm;
  images: LaunchImageOption[];
  maxInitialBuySol: number;
  getToken: () => Promise<string | null>;
  onLaunched: (coin: LaunchedCoin) => void;
  preview: LaunchPreview;
};

type Phase =
  | { step: "form" }
  | { step: "working"; message: string }
  | { step: "done"; coin: LaunchedCoin; buyNote: string | null };

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

/** The Launch coin tab's form (design: Bluebuild App.dc.html, Launch coin), with its own wallet connection. */
export default function LaunchCoinForm(props: LaunchCoinFormProps) {
  const { getToken } = props;
  const connectionConfig = useMemo(
    () => ({ commitment: "confirmed" as const, fetch: launchpadRpcFetch(getToken) }),
    [getToken],
  );
  const endpoint = useMemo(() => launchpadRpcUrl(), []);

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <WalletProvider wallets={[]} autoConnect={false}>
        <LaunchCoinFormBody {...props} />
      </WalletProvider>
    </ConnectionProvider>
  );
}

function LaunchCoinFormBody({ projectId, initialForm, images, maxInitialBuySol, getToken, onLaunched, preview }: LaunchCoinFormProps) {
  const { connection } = useConnection();
  const { wallets, wallet, select, connect, disconnect, connected, connecting, publicKey, signAllTransactions, signTransaction } = useWallet();
  const [form, setForm] = useState<LaunchForm>(initialForm);
  const [imageChoice, setImageChoice] = useState<string | null>(images[0]?.src || null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "form" });
  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const busy = phase.step === "working";

  const availableWallets = wallets.filter(
    (item) => item.readyState === WalletReadyState.Installed || item.readyState === WalletReadyState.Loadable,
  );
  const initialBuy = Number(form.initialBuySol || 0);
  const logoSrc = uploadedImage || imageChoice;

  // Connect only after a click. Reconnecting a remembered wallet on page load could leave the
  // adapter "connecting" forever (missed popup, locked wallet), which blocked every wallet button.
  const pendingWallet = useRef<WalletName | null>(null);
  const forgotRemembered = useRef(false);
  useEffect(() => {
    if (forgotRemembered.current) return;
    forgotRemembered.current = true;
    select(null);
  }, [select]);
  useEffect(() => {
    const wanted = pendingWallet.current;
    if (!wanted || connected || connecting) return;
    if (!wallet) {
      select(wanted);
      return;
    }
    if (wallet.adapter.name !== wanted) return;
    pendingWallet.current = null;
    connect().catch(() => setError("The wallet didn't connect. Open your wallet, unlock it, and try again."));
  }, [wallet, connected, connecting, connect, select]);

  const chooseWallet = (name: WalletName) => {
    setError(null);
    pendingWallet.current = name;
    // A fresh selection resets an attempt that never finished; the effect above then connects.
    if (wallet) select(null);
    else select(name);
  };

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
      setPhase({ step: "working", message: "Building your pitch deck and coin details (about a minute)…" });
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

      setPhase({ step: "working", message: "Waiting for wallet signature…" });
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

  // With no wallet yet, the big button connects the first wallet found instead of sitting disabled.
  const needsWallet = !publicKey && availableWallets.length > 0 && !busy && phase.step === "form";
  const ticker = form.symbol.trim().replace(/^\$/, "").toUpperCase() || "???";
  const buttonLabel = busy
    ? phase.message
    : phase.step === "done"
      ? "Launched · view pitch deck →"
      : connecting
        ? `Waiting for ${wallet?.adapter.name || "your wallet"}… check its popup`
        : !publicKey
        ? "Connect wallet to launch"
        : `Launch $${ticker} on pump.fun →`;

  return (
    <div className="bb-launch">
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <span className="bb-eyebrow is-amber">Pitch deck &amp; coin · your wallet</span>
          <span className="bb-sheet__h">Launch a coin for it</span>
        </div>

        {phase.step === "done" ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[15px] leading-relaxed text-[#f4f7fb]">
              <b>{phase.coin.name}</b> <span className="text-[#a9bedd]">${phase.coin.symbol}</span> is live on pump.fun.
            </p>
            {phase.buyNote && <p className="m-0 text-sm text-[#a9bedd]">{phase.buyNote}</p>}
            <p className="m-0 break-all font-[family-name:var(--craft-mono)] text-[11px] text-[#7f9ccc]">{phase.coin.mint}</p>
            <div className="flex flex-wrap gap-2">
              <a href={phase.coin.pump_url} target="_blank" rel="noreferrer" className="bb-launch-btn">View on pump.fun →</a>
              {phase.coin.product_page_path && (
                <a href={phase.coin.product_page_path} target="_blank" rel="noreferrer" className="bb-panel-link">Open pitch deck</a>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="bb-field">
              <span className="bb-field__label">Wallet</span>
              {publicKey ? (
                <span className="bb-wallet">
                  <span>
                    ● {wallet?.adapter.name} · {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
                    {balanceSol !== null && <span className="text-[#a9bedd]"> · {balanceSol.toFixed(3)} SOL</span>}
                  </span>
                  <button type="button" disabled={busy} onClick={() => void disconnect()}>Change</button>
                </span>
              ) : availableWallets.length ? (
                <span className="flex flex-wrap gap-2">
                  {availableWallets.map((item) => (
                    <button
                      key={item.adapter.name}
                      type="button"
                      className="bb-wallet-option"
                      onClick={() => chooseWallet(item.adapter.name)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- wallet-provided icon */}
                      <img src={item.adapter.icon} alt="" className="h-5 w-5" />
                      {item.adapter.name}
                    </button>
                  ))}
                </span>
              ) : (
                <span className="text-[13px] text-[#a9bedd]">
                  No Solana wallet found in this browser. Install{" "}
                  <a href="https://phantom.com/download" target="_blank" rel="noreferrer" className="underline">Phantom</a> or{" "}
                  <a href="https://solflare.com/download" target="_blank" rel="noreferrer" className="underline">Solflare</a>, then reload this page.
                </span>
              )}
              <span className="text-[11.5px] text-[#7f9ccc]">Use the same wallet you signed in to Bluebuild with.</span>
            </div>

            <label className="bb-field">
              <span className="bb-field__label">Coin name</span>
              <input className="bb-input" value={form.name} maxLength={32} onChange={update("name")} disabled={busy} placeholder="Smart Sip Bottle" />
            </label>
            <label className="bb-field">
              <span className="bb-field__label">Ticker</span>
              <input
                className="bb-input"
                value={form.symbol}
                maxLength={10}
                onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase().replace(/[^A-Z0-9$]/g, "") }))}
                disabled={busy}
                placeholder="SIP"
              />
            </label>
            <label className="bb-field">
              <span className="bb-field__label">One-line pitch</span>
              <textarea className="bb-input min-h-[64px] resize-y" value={form.description} maxLength={500} onChange={update("description")} disabled={busy} placeholder="What it does, in a sentence" />
            </label>

            <div className="bb-field">
              <span className="bb-field__label">Logo</span>
              <span className="flex flex-wrap gap-2">
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
                      className={`bb-logo-option ${selected ? "is-active" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- design image */}
                      <img src={image.src} alt={image.label} />
                    </button>
                  );
                })}
                <label className={`bb-logo-option is-upload ${uploadedImage ? "is-active" : ""}`}>
                  {uploadedImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local upload preview
                    <img src={uploadedImage} alt="Uploaded logo" />
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
              </span>
            </div>

            <div className="bb-locked-site">
              <span className="bb-field__label">Website · locked</span>
              <span>
                <b>Your coin&apos;s pitch deck, added automatically.</b> Bluebuild builds a page for this design with its renders, 3D model, use cases,
                specs and production costs, and sets it as the coin&apos;s website. It can&apos;t be changed or removed.
              </span>
            </div>

            <label className="bb-field">
              <span className="bb-field__label">X / Twitter (optional)</span>
              <input className="bb-input" value={form.twitter} onChange={update("twitter")} placeholder="https://x.com/…" disabled={busy} />
            </label>
            <label className="bb-field">
              <span className="bb-field__label">Telegram (optional)</span>
              <input className="bb-input" value={form.telegram} onChange={update("telegram")} placeholder="https://t.me/…" disabled={busy} />
            </label>
            <label className="bb-field">
              <span className="bb-field__label">Your first buy in SOL (optional)</span>
              <input
                className="bb-input"
                type="number"
                inputMode="decimal"
                min={0}
                max={maxInitialBuySol}
                step="0.01"
                value={form.initialBuySol}
                onChange={update("initialBuySol")}
                disabled={busy}
              />
              <span className="text-[11.5px] text-[#7f9ccc]">
                You pay pump.fun&apos;s small creation and network fees (about {LAUNCH_COST_ESTIMATE_SOL} SOL) plus any first buy. Bluebuild takes no fee.
              </span>
            </label>

            <label className="bb-accept">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy} />
              <span>
                I&apos;m creating this coin myself, from my own wallet, on pump.fun. Bluebuild doesn&apos;t endorse or promote it, takes no fee,
                and can&apos;t undo, change or refund anything. Coins can lose all their value.
              </span>
            </label>

            {error && <div role="alert" className="bb-alert">{error}</div>}

            <button
              type="button"
              onClick={() => (needsWallet ? chooseWallet(availableWallets[0].adapter.name) : void launch())}
              disabled={busy || (Boolean(formProblem) && !needsWallet)}
              className={`bb-launch-btn is-big ${busy ? "is-busy" : ""}`}
            >
              {buttonLabel}
            </button>
            <p className="m-0 text-[12px] text-[#a9bedd]" aria-live="polite">{busy ? "" : formProblem || "Ready to launch."}</p>
          </>
        )}

        <p className="bb-launch__legal">
          You create the coin on pump.fun from your own wallet. Bluebuild never holds your keys, takes no fee, doesn&apos;t endorse any coin and
          can&apos;t undo transactions. Crypto is risky.
        </p>
      </div>

      <PitchDeckPreview
        name={phase.step === "done" ? phase.coin.name : form.name}
        description={phase.step === "done" ? phase.coin.description : form.description}
        symbol={phase.step === "done" ? phase.coin.symbol : form.symbol}
        logo={phase.step === "done" ? phase.coin.image_url : logoSrc}
        preview={preview}
        launched={phase.step === "done"}
      />
    </div>
  );
}
