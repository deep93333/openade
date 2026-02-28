import { useEffect, useRef } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  Button,
} from "@agentide/ui";
import { useAgentStore } from "@/store/agent.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useUIStore } from "@/store/ui.store";
import { useChatEditorStore } from "@/store/chat-editor.store";
import { ChatEditor } from "./chat-editor";
import { MessageList } from "./message-list";

const playCompletionSound = (isError = false) => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (isError) {
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } else {
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    }
  } catch (e) {
    // Audio not supported or blocked
  }
};

const playSendSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.08);
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.08);
  } catch (e) {
    // Audio not supported or blocked
  }
};

export const AgentPanel = () => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const runtime = useAgentStore((s) =>
    s.getActiveRuntime(activeWorkspaceId ?? "")
  );
  const activeThread = useAgentStore((s) =>
    s.getActiveThread(activeWorkspaceId ?? "")
  );
  const threadStatus = runtime.status;
  const threadError = runtime.error;
  const threadStreamingText = runtime.streamingText ?? "";

  const clearError = useAgentStore((s) => s.clearError);
  const persistWorkspace = useAgentStore((s) => s.persistWorkspace);

  const openAgentLogDrawer = useUIStore((s) => s.openAgentLogDrawer);

  const fetchModelOptions = useChatEditorStore((s) => s.fetchModelOptions);
  const prevStatusRef = useRef(threadStatus);
  const prevMessageCountRef = useRef(activeThread?.messages.length ?? 0);

  useEffect(() => {
    fetchModelOptions();
  }, [fetchModelOptions]);

  useEffect(() => {
    if (activeWorkspaceId && !threadStreamingText) {
      persistWorkspace(activeWorkspaceId);
    }
  }, [activeWorkspaceId, threadStreamingText, persistWorkspace]);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const wasRunning = prevStatus === "running";
    const isNowIdle = threadStatus === "idle";
    const isNowStopped = threadStatus === "stopped";

    if (wasRunning && (isNowIdle || isNowStopped)) {
      playCompletionSound(!!threadError);
    }

    prevStatusRef.current = threadStatus;
  }, [threadStatus, threadError]);

  useEffect(() => {
    const currentMessageCount = activeThread?.messages.length ?? 0;
    const prevMessageCount = prevMessageCountRef.current;

    if (currentMessageCount > prevMessageCount) {
      playSendSound();
    }

    prevMessageCountRef.current = currentMessageCount;
  }, [activeThread?.messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <MessageList />
      </div>

      {threadError && (
        <Alert
          variant="destructive"
          className="mx-4 mb-2 border-red-500/30 bg-red-500/5 text-red-700"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <AlertDescription className="text-xs flex-1 min-w-0">
                <span className="whitespace-pre-wrap wrap-break-word">
                  {threadError.includes("\n") ? threadError.split("\n")[0] : threadError}
                </span>
              </AlertDescription>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-7 w-7 text-red-700 hover:bg-red-500/20"
                  onClick={() => void navigator.clipboard.writeText(threadError)}
                >
                  <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-7 w-7 text-red-700 hover:bg-red-500/20"
                  onClick={() => activeWorkspaceId && clearError(activeWorkspaceId)}
                >
                  <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-7 text-red-700 hover:bg-red-500/20"
                  onClick={openAgentLogDrawer}
                  title="View agent log for debugging"
                >
                  <span className="text-xs">Log</span>
                </Button>
              </div>
            </div>
            {threadError.startsWith("Claude Code process exited with code 1") && (
              <p className="text-[11px] text-red-600/90 mt-1">
                Common causes: auth (API key vs subscription), a tool returning too much data (e.g. search/grep), or the Resurf CLI not being on PATH in the agent environment. Try a shorter/simpler prompt or run the Resurf command in the workspace terminal to confirm it works.
              </p>
            )}
            {threadError.includes("\n") && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="details" className="border-red-500/20">
                  <AccordionTrigger className="py-2 text-xs text-red-700 hover:no-underline hover:text-red-800">
                    Details
                  </AccordionTrigger>
                  <AccordionContent className="pb-2 pt-0">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap wrap-break-word max-h-48 overflow-auto rounded bg-red-500/10 p-2 text-red-800">
                      {threadError}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </Alert>
      )}

      <div className="mx-auto mb-4 w-full max-w-2xl shrink-0 px-2">
        <ChatEditor embedded />
      </div>
    </div>
  );
};
