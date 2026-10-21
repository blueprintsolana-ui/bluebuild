"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileBox, Loader2, Printer, RefreshCw, TriangleAlert } from "lucide-react";
import { webConfig } from "../../lib/config";
import { useFormaAuth } from "../../lib/forma-auth";
import { waitForExport, type GcodeExportResult } from "./export-job";

type ExportPrinter = {
  printer_id: string; display_name: string; nozzle_mm: number; material: string;
  layer_height_mm: number; available: boolean; unavailable_reason?: string | null;
};
type DownloadableArtifact = {
  filename: string;
  sha256: string;
  size_bytes?: number | null;
  download_url: string;
};
type MeshExportFormat = "stl" | "3mf" | "obj";
type Manifest = {
  project_id: string;
  step: DownloadableArtifact;
  mesh_exports?: Partial<Record<MeshExportFormat, DownloadableArtifact>>;
  printers: ExportPrinter[];
};
type SliceState = "idle" | "queued" | "running" | "completed" | "failed";

function normalizeApiUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return !trimmed ? "/api" : trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}
const API_URL = normalizeApiUrl(webConfig.apiBaseUrl);
const MESH_EXPORT_FORMATS: MeshExportFormat[] = ["stl", "3mf", "obj"];

function formatBytes(value?: number | null): string {
  if (!value || value < 1) return "Size unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as Record<string, unknown>;
  const detail = value.detail;
  if (detail && typeof detail === "object") {
    const message = (detail as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return typeof value.message === "string" ? value.message : fallback;
}

type ProjectExportsPanelProps = {
  projectId: string;
  canDownloadAssets: boolean;
  onDownloadJSON: () => void;
  onDownloadMarkdown: () => void;
};

export default function ProjectExportsPanel({
  projectId,
  canDownloadAssets,
  onDownloadJSON,
  onDownloadMarkdown,
}: ProjectExportsPanelProps) {
  const { authRequired, getToken, isLoaded, isSignedIn, openSignIn } = useFormaAuth();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [result, setResult] = useState<GcodeExportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sliceState, setSliceState] = useState<SliceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const generation = useRef<AbortController | null>(null);
  const canRead = isLoaded && (!authRequired || isSignedIn);
  const currentManifest = manifest?.project_id === projectId ? manifest : null;
  const selectedPrinter = currentManifest?.printers.find((p) => p.printer_id === selectedPrinterId);
  const sourceSha = currentManifest?.step.sha256;
  const storageKey = `forma.export.${projectId}.${selectedPrinterId}.${sourceSha || ""}`;
  const busy = sliceState === "queued" || sliceState === "running";

  const requestHeaders = useCallback(async (json = false): Promise<Record<string, string>> => {
    const token = await getToken();
    return { Accept: "application/json", ...(json ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }, [getToken]);

  const requestJson = useCallback(async (url: string, signal: AbortSignal, body?: object) => {
    const response = await fetch(url, {
      method: body ? "POST" : "GET", headers: await requestHeaders(Boolean(body)),
      body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(payload, `Export request failed (${response.status}).`));
    return payload;
  }, [requestHeaders]);

  useEffect(() => {
    const controller = new AbortController();
    setManifest(null);
    setResult(null);
    if (!projectId || !canRead) return () => controller.abort();
    setLoading(true);
    setError(null);
    void requestJson(`${API_URL}/projects/${encodeURIComponent(projectId)}/exports`, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        const next = payload as Manifest;
        if (next?.project_id !== projectId || !next.step?.sha256 || !Array.isArray(next.printers)) {
          throw new Error("Invalid project exports response.");
        }
        setManifest(next);
        setSelectedPrinterId((current) => next.printers.some((p) => p.printer_id === current)
          ? current : next.printers.find((p) => p.available)?.printer_id || next.printers[0]?.printer_id || "");
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load exports."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, canRead, refresh, requestJson]);

  useEffect(() => {
    generation.current?.abort();
    setResult(null);
    setSliceState("idle");
    if (canRead && sourceSha) {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || "null") as GcodeExportResult | null;
        if (parsed?.project_id === projectId && parsed.printer_id === selectedPrinterId
            && parsed.source_step_sha256 === sourceSha && parsed.gcode?.sha256) {
          setResult(parsed);
          setSliceState("completed");
        }
      } catch { /* Storage is optional; it must not block exports. */ }
    }
    return () => generation.current?.abort();
  }, [storageKey, sourceSha, projectId, selectedPrinterId, canRead]);

  const downloadAuthenticated = useCallback(async (relativeUrl: string, filename: string) => {
    setError(null);
    // Only authenticated artifact routes belonging to this project may be downloaded.
    if (!relativeUrl.startsWith(`/projects/${encodeURIComponent(projectId)}/exports/`)) {
      throw new Error("Invalid project artifact URL.");
    }
    const response = await fetch(`${API_URL}${relativeUrl}`, { headers: await requestHeaders(), cache: "no-store" });
    if (!response.ok) throw new Error(errorMessage(await response.json().catch(() => null), `Download failed (${response.status}).`));
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }, [projectId, requestHeaders]);

  const generateGcode = async () => {
    if (!selectedPrinter?.available || !sourceSha || busy) return;
    generation.current?.abort();
    const controller = new AbortController();
    generation.current = controller;
    setResult(null); setError(null); setSliceState("queued");
    try {
      const initial = await requestJson(`${API_URL}/projects/${encodeURIComponent(projectId)}/exports/gcode`,
        controller.signal, { printer_id: selectedPrinterId });
      const next = await waitForExport(initial, {
        apiUrl: API_URL, projectId, printerId: selectedPrinterId, sourceSha256: sourceSha,
        signal: controller.signal, request: requestJson, onState: setSliceState,
      });
      if (controller.signal.aborted) return;
      setResult(next); setSliceState("completed");
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Download still works. */ }
    } catch (cause) {
      if (controller.signal.aborted) return;
      setSliceState("failed");
      setError(cause instanceof Error ? cause.message : "G-code generation failed.");
    }
  };
  const download = (url: string, filename: string) => {
    void downloadAuthenticated(url, filename).catch((cause) => setError(cause instanceof Error ? cause.message : "Download failed."));
  };

  if (authRequired && isLoaded && !isSignedIn) {
    return <div className="flex h-full items-center justify-center p-6"><div className="text-center">
      <FileBox className="mx-auto mb-3 h-7 w-7" /><h3 className="text-sm font-semibold">Sign in to export this project</h3>
      <button type="button" className="mt-4 rounded-lg border px-3 py-2 text-xs"
        onClick={() => openSignIn({ redirectUrl: window.location.href })}>Sign in</button>
    </div></div>;
  }
  if (loading && !currentManifest) return <div className="flex h-full items-center justify-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" />Loading exports…</div>;

  const fileRows = [
    { key: "json", name: "Project JSON", desc: "Hardware model and project metadata (.json)", ext: "JSON", run: onDownloadJSON },
    { key: "md", name: "Build documentation", desc: "Assembly steps and safety audit (.md)", ext: "MD", run: onDownloadMarkdown },
  ];
  const cadFormats: { key: string; label: string; artifact: DownloadableArtifact | undefined; note: string }[] = currentManifest ? [
    { key: "step", label: "STEP", artifact: currentManifest.step, note: "Source CAD" },
    ...MESH_EXPORT_FORMATS.map((format) => ({
      key: format,
      label: format.toUpperCase(),
      artifact: currentManifest.mesh_exports?.[format],
      note: format === "stl" ? "3D printing" : format === "3mf" ? "Print package" : "Mesh",
    })),
  ] : [];
  const gcodeDone = Boolean(result && sliceState === "completed");

  return <div className="bb-sheet h-full overflow-y-auto">
    <div className="bb-sheet__body">
      <div className="flex flex-col gap-1.5">
        <span className="bb-eyebrow">Project exports</span>
        <span className="text-[22px] font-semibold text-[#f4f7fb]">Download your project assets</span>
        <span className="text-sm text-[#a9bedd]">Project data, build documentation, CAD and fabrication files in one place.</span>
      </div>

      <section className="bb-card">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">Project files</span>
          <span className="text-[13px] text-[#a9bedd]">Portable source data and builder-facing documentation.</span>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
          {fileRows.map((row) => (
            <button
              key={row.key}
              type="button"
              disabled={!canDownloadAssets}
              title={canDownloadAssets ? `Download ${row.name.toLowerCase()}` : "Files are available only on projects you generated."}
              className={`bb-file ${downloaded[row.key] ? "is-done" : ""}`}
              onClick={() => {
                row.run();
                setDownloaded((current) => ({ ...current, [row.key]: true }));
              }}
            >
              <span className="bb-file__ext">{row.ext}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">{row.name}</span>
                <span className="text-xs text-[#a9bedd]">{row.desc}</span>
              </span>
              <span className="bb-file__mark">{downloaded[row.key] ? "✓" : "↓"}</span>
            </button>
          ))}
        </div>
        {!canDownloadAssets && <p className="bb-note">Downloads are available only on projects you generated.</p>}
      </section>

      <div className="flex flex-col gap-1">
        <span className="bb-eyebrow">Manufacturing</span>
        <span className="text-[13.5px] text-[#a9bedd]">The STEP model is the source of truth. STL, 3MF and OBJ come from the same geometry, and so does printer G-code.</span>
      </div>
      {error && <div role="alert" className="bb-alert">
        <TriangleAlert className="h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>
        <button type="button" className="underline" disabled={busy} onClick={() => setRefresh((v) => v + 1)}>Refresh</button></div>}

      <section className="bb-card is-row">
        <span className="bb-icon-box"><FileBox className="h-4 w-4" /></span>
        <span className="flex min-w-[200px] flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">CAD geometry</span>
          <span className="text-[13px] text-[#a9bedd]">
            {currentManifest ? `${currentManifest.step.filename} · ${formatBytes(currentManifest.step.size_bytes)}` : "No CAD geometry for this revision yet"}
          </span>
          {sourceSha && <span className="font-[family-name:var(--craft-mono)] text-[10.5px] text-[#7f9ccc]">sha256:{sourceSha.slice(0, 16)}…</span>}
        </span>
        {cadFormats.length > 0 && (
          <div className="bb-formats" role="group" aria-label="Download CAD format">
            {cadFormats.map((format) => (
              <button
                key={format.key}
                type="button"
                disabled={!format.artifact}
                title={format.artifact ? `Download ${format.label} · ${format.note}` : `${format.label} is not available for this project revision.`}
                onClick={() => format.artifact && download(format.artifact.download_url, format.artifact.filename)}
              >
                {format.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="bb-card">
        <div className="flex items-center gap-3.5">
          <span className="bb-icon-box"><Printer className="h-4 w-4" /></span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">Printer G-code</span>
            <span className="text-[13px] text-[#a9bedd]">A slicer processes your saved STEP. The agent never writes raw G-code.</span>
          </span>
        </div>
        <span className="bb-eyebrow font-bold">Printer</span>
        <div className="flex flex-wrap gap-2.5">
          <select value={selectedPrinterId} disabled={busy || !currentManifest} onChange={(event) => setSelectedPrinterId(event.target.value)} className="bb-select" aria-label="Printer">
            {(currentManifest?.printers || []).map((p) => <option key={p.printer_id} value={p.printer_id}>{p.display_name} · {p.nozzle_mm.toFixed(1)} mm</option>)}
          </select>
          <button
            type="button"
            disabled={(!gcodeDone && !selectedPrinter?.available) || busy}
            onClick={() => (gcodeDone && result ? download(result.gcode.download_url, result.gcode.filename) : void generateGcode())}
            className={`bb-gcode-btn ${gcodeDone ? "is-done" : ""}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : gcodeDone ? <Download className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            {sliceState === "queued" ? "Queued…" : sliceState === "running" ? "Slicing…" : gcodeDone ? "Download G-code" : "Generate G-code"}
          </button>
        </div>
        {busy && <div className="bb-slice-bar" aria-hidden="true"><div /></div>}
        {selectedPrinter && <span className="text-[11.5px] text-[#a9bedd]">{selectedPrinter.material} · {selectedPrinter.nozzle_mm.toFixed(1)} mm nozzle · {selectedPrinter.layer_height_mm.toFixed(2)} mm layers</span>}
        {selectedPrinter && !selectedPrinter.available && <p className="bb-note text-[#ffb547]">{selectedPrinter.unavailable_reason || "The slicing worker is not configured."}</p>}
        {gcodeDone && result && <>
          <span className="bb-gcode-result">✓ {result.gcode.filename} · {result.printer} · {result.slicer} · {formatBytes(result.gcode.size_bytes)}</span>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="text-xs text-[#a9bedd] underline" onClick={() => void generateGcode()}>Regenerate</button>
          </div>
          <details><summary className="cursor-pointer text-xs font-medium text-[#a9bedd]">View G-code preview</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-[#0b2249] p-3 text-[10px] leading-4">{result.gcode.preview}</pre></details>
          <p className="bb-note">Review the toolpath in your slicer before printing. This export does not connect to or start a printer.</p>
        </>}
      </section>
    </div>
  </div>;
}
