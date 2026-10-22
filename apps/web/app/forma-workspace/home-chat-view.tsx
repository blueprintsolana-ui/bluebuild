"use client";

import type { ChangeEventHandler, ClipboardEventHandler, FormEventHandler, ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  KeyRound,
  RefreshCw,
  Settings,
  Square,
} from "lucide-react";

import { shouldOfferFailedBuildRetry } from "../../lib/conversation-build-state";
import ConversationMessageList, { type ConversationMessage } from "./conversation-message-list";
import { AuthoringModeBanner } from "./hosted-chat-maintenance";
import useChatAutoScroll from "./use-chat-auto-scroll";
import ChatProjectLayout from "./chat-project-layout";
import type { ProjectHistoryConfig } from "./project-history";
import { ChatAttachmentButton, ChatAttachmentSelection } from "./chat-attachments";
import GenerationModeSelector, { type GenerationMode } from "./generation-mode-selector";
import { ComposerFrame, EmptyDrawing, ExampleCards, ScopeChip } from "./bb-shell";

export type { GenerationMode } from "./generation-mode-selector";

type HomeChatViewProps = {
  started: boolean;
  conversationKey: string;
  workspaceTitle?: ReactNode;
  messages: ConversationMessage[];
  renderPipelineProgress: (message: ConversationMessage) => ReactNode;
  projectArtifact?: ReactNode;
  projectArtifactId?: string | null;
  history?: ProjectHistoryConfig;
  examples: string[];
  onSelectExample: (example: string) => void;
  generationMode: GenerationMode;
  onGenerationModeChange: (mode: GenerationMode) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  canBuildNow: boolean;
  buildNowLoading: boolean;
  onBuildNow: () => void;
  onSelectContextSuggestion: (suggestion: string) => void;
  isLoading: boolean;
  generationReady: boolean;
  needsGenerationProvider: boolean;
  needsImageProvider: boolean;
  selectedImage: string | null;
  selectedDocumentName: string | null;
  onRemoveImage: () => void;
  onRemoveDocument: () => void;
  notice: string | null;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  generationActive: boolean;
  onStop: () => void;
  canRetryFailedBuild: boolean;
  retryLabel?: string;
  retryingFailedBuild: boolean;
  onRetryFailedBuild: () => void;
  hasGenerationInput: boolean;
  inputValid: boolean;
  imageInputRef: RefObject<HTMLInputElement | null>;
  onImageChange: ChangeEventHandler<HTMLInputElement>;
  onImagePaste: ClipboardEventHandler<HTMLTextAreaElement>;
  readOnly: boolean;
  authoringActive?: boolean;
  /** Shown at the start of the drawing header (mobile sidebar button). */
  headLeading?: ReactNode;
};

export default function HomeChatView({
  started,
  conversationKey,
  workspaceTitle,
  messages,
  renderPipelineProgress,
  projectArtifact,
  projectArtifactId,
  history,
  examples,
  onSelectExample,
  generationMode,
  onGenerationModeChange,
  onSubmit,
  canBuildNow,
  buildNowLoading,
  onBuildNow,
  onSelectContextSuggestion,
  isLoading,
  generationReady,
  needsGenerationProvider,
  needsImageProvider,
  selectedImage,
  selectedDocumentName,
  onRemoveImage,
  onRemoveDocument,
  notice,
  prompt,
  onPromptChange,
  generationActive,
  onStop,
  canRetryFailedBuild,
  retryLabel = "Try failed build again",
  retryingFailedBuild,
  onRetryFailedBuild,
  hasGenerationInput,
  inputValid,
  imageInputRef,
  onImageChange,
  onImagePaste,
  readOnly,
  authoringActive = false,
  headLeading,
}: HomeChatViewProps) {
  const { containerRef, endRef, handleScroll } = useChatAutoScroll(conversationKey, messages);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const retryMode = shouldOfferFailedBuildRetry({
    canRetryFailedBuild,
    hasInput: hasGenerationInput,
    generationActive,
  });
  const promptRunning = isLoading || generationActive;
  const canFinishPrompt = !generationActive && !retryMode && hasGenerationInput && generationReady && !isLoading;
  const primaryActionLabel = generationActive
    ? "Stop generation"
    : retryMode
      ? retryLabel
      : inputValid
        ? generationMode === "regular" ? "Generate project" : "Send context"
        : "Check hardware idea";

  useEffect(() => {
    if (selectedImage || selectedDocumentName) promptRef.current?.focus();
  }, [selectedImage, selectedDocumentName]);

  const requestNumber = messages.filter((message) => message.role === "user").length + 1;
  const sendLabel = generationActive
    ? "Stop"
    : retryMode
      ? retryLabel
      : isLoading
        ? "Drafting…"
        : started ? "Send →" : "Draw it →";

  return (
    <ChatProjectLayout
      conversationKey={conversationKey}
      projectId={projectArtifactId}
      project={started ? projectArtifact : null}
      history={history}
      heading={{
        title: started && workspaceTitle ? workspaceTitle : "Untitled drawing",
        leading: headLeading,
        drafting: generationActive,
      }}
    >
    <section className={`bb-chat ${started ? "is-started" : "is-empty"}`}>
      {!started && <EmptyDrawing />}
      {started && (
        <div ref={containerRef} onScroll={handleScroll} className="bb-chat__scroll">
          <div className="bb-chat__col">
            {authoringActive && <AuthoringModeBanner compact />}
            <ConversationMessageList
              messages={messages}
              renderPipelineProgress={renderPipelineProgress}
              onSelectContextSuggestion={readOnly ? undefined : onSelectContextSuggestion}
              isLoading={readOnly ? false : isLoading}
              assistantLabel={authoringActive ? "Bluebuild Agent" : "Bluebuild"}
              canBuildNow={readOnly ? false : canBuildNow}
              buildNowLoading={readOnly ? false : buildNowLoading}
              onBuildNow={readOnly ? undefined : onBuildNow}
            />
            <div ref={endRef} />
          </div>
        </div>
      )}

      {(!readOnly || !started) && (
        <form onSubmit={onSubmit} className="bb-chat__form">
          {(needsGenerationProvider || needsImageProvider) && (
            <section className="mb-3 rounded-xl border border-white/5 bg-[#181b22] p-3 text-left sm:p-4" aria-label="Bring your own key setup">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <KeyRound className="h-4 w-4" />
                    Bring your own key
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    Provider credentials are configured per account and are not taken from the public frontend environment.
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Open settings
                </Link>
              </div>
              <div className={`mt-3 grid gap-2 ${needsGenerationProvider && needsImageProvider ? "md:grid-cols-2" : ""}`}>
                {needsGenerationProvider && (
                  <div className="rounded-lg border border-white/5 bg-[#0f1117] p-3">
                    <div className="text-xs font-medium text-zinc-100">LLM provider required</div>
                    <ol className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
                      <li>1. Open Settings and choose a model provider.</li>
                      <li>2. Enter its scoped API key and model.</li>
                      <li>3. Turn Enabled on, save, then return here.</li>
                    </ol>
                  </div>
                )}
                {needsImageProvider && (
                  <div className="rounded-lg border border-white/5 bg-[#0f1117] p-3">
                    <div className="text-xs font-medium text-zinc-100">Image provider required</div>
                    <ol className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
                      <li>1. Open Settings and select Image Generation.</li>
                      <li>2. Choose a provider and add its scoped key, model, and required confirmation.</li>
                      <li>3. Enable and save it before returning to your build.</li>
                    </ol>
                  </div>
                )}
              </div>
            </section>
          )}

          {notice && (
            <div id="generation-input-notice" role="status" className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span className="break-anywhere min-w-0 flex-1">{notice.replace(/\bOpenCode\b/g, "Bluebuild Agent")}</span>
            </div>
          )}

          <ComposerFrame request={requestNumber} refining={Boolean(projectArtifactId)} busy={promptRunning}>
            <div className="bb-composer__attachments">
              <ChatAttachmentSelection
                imageInputRef={imageInputRef}
                onImageChange={onImageChange}
                selectedImage={selectedImage}
                selectedDocumentName={selectedDocumentName}
                onRemoveImage={onRemoveImage}
                onRemoveDocument={onRemoveDocument}
              />
            </div>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              onPaste={onImagePaste}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (isLoading) return;
                  if (retryMode) {
                    onRetryFailedBuild();
                    return;
                  }
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={
                selectedImage
                  ? "Add constraints, references, or what you want from this image…"
                  : selectedDocumentName
                    ? "Tell Bluebuild what to build or what to use from this PDF…"
                    : started
                      ? "Refine it: “longer battery”, “add a reminder buzzer”, “make it cheaper”…"
                      : "e.g. a 1 L bottle that shows the water temperature and the time"
              }
              aria-label="Describe what you want to build"
              aria-invalid={Boolean(notice)}
              aria-describedby={notice ? "generation-input-notice" : undefined}
              rows={2}
              className="bb-composer__input"
            />
            <div className="bb-composer__foot">
              <ChatAttachmentButton imageInputRef={imageInputRef} variant="chip" />
              <ScopeChip />
              <GenerationModeSelector
                value={generationMode}
                onChange={onGenerationModeChange}
                disabled={generationActive || isLoading}
              />
              <span className="bb-composer__spacer" />
              {canFinishPrompt && <span className="bb-composer__hint" aria-hidden="true">ENTER ↵</span>}
              <button
                type={generationActive || retryMode ? "button" : "submit"}
                onClick={generationActive || retryMode ? (event) => {
                  event.preventDefault();
                  if (generationActive) onStop();
                  else onRetryFailedBuild();
                } : undefined}
                disabled={retryMode ? retryingFailedBuild : !generationActive && (isLoading || !hasGenerationInput || !generationReady)}
                className={`bb-composer__send${generationActive ? " is-stop" : ""}`}
                aria-label={canFinishPrompt ? `${primaryActionLabel}, or press Enter` : primaryActionLabel}
                title={canFinishPrompt ? `${primaryActionLabel} · Enter` : primaryActionLabel}
              >
                {generationActive ? (
                  <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                ) : retryMode || isLoading ? (
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading || retryingFailedBuild ? "animate-spin" : ""}`} aria-hidden="true" />
                ) : null}
                {sendLabel}
              </button>
            </div>
          </ComposerFrame>
        </form>
      )}

      {!started && <ExampleCards examples={examples} onSelect={onSelectExample} />}
    </section>
    </ChatProjectLayout>
  );
}
