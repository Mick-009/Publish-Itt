import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { aiApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

function createAssistantIntro(chapterTitle, hasChapter) {
  if (!hasChapter) {
    return {
      id: "assistant-empty",
      role: "assistant",
      content:
        "Open a chapter and I’ll meet you there. Ask me about pacing, voice, a tricky paragraph, anything you want a second pair of eyes on.",
    };
  }

  return {
    id: "assistant-intro",
    role: "assistant",
    content: `Reading "${chapterTitle || "this chapter"}" with you. Ask me about a passage, a character, the pacing — or highlight something and I’ll focus there.`,
  };
}

export default function ThadChatPanel({
  projectId,
  chapterId,
  chapterTitle,
  currentChapterContent,
  selectedText,
}) {
  const [messages, setMessages] = useState([
    createAssistantIntro(chapterTitle, Boolean(chapterId)),
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef(null);

  useEffect(() => {
    setMessages([createAssistantIntro(chapterTitle, Boolean(chapterId))]);
    setInput("");
  }, [chapterId, chapterTitle]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );

    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || !chapterId) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await aiApi.chat(
        message,
        currentChapterContent || "",
        selectedText?.trim() || null,
        projectId,
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            response.data?.response || "THAD couldn't answer that right now.",
        },
      ]);
    } catch (error) {
      console.error("THAD chat failed:", error);
      toast.error("Failed to get a response from THAD");
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: "THAD couldn't respond right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="thad-chat-panel">
      <div className="shrink-0 space-y-2 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-medium">Ask THAD</h3>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Ask questions about the current chapter. THAD can use the live chapter
          draft and any selected text for context.
        </p>
        {selectedText?.trim() ? (
          <Badge variant="outline" className="text-xs">
            Selected text included
          </Badge>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea
          ref={scrollAreaRef}
          className="h-full rounded-sm border bg-muted/30"
        >
          <div className="space-y-3 p-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm leading-6",
                  message.role === "user"
                    ? "ml-6 bg-accent text-accent-foreground"
                    : "mr-6 border bg-background shadow-sm",
                )}
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide opacity-70">
                  {message.role === "user" ? (
                    <>
                      <MessageSquare className="h-3 w-3" />
                      You
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      THAD
                    </>
                  )}
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="mr-6 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  THAD is thinking...
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>

      <div className="shrink-0 space-y-2 pt-3">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!chapterId || loading}
          placeholder={
            chapterId
              ? "Ask about this chapter..."
              : "Select a chapter to chat with THAD"
          }
          className="min-h-[72px] resize-none rounded-sm"
          data-testid="thad-chat-input"
        />
        <Button
          onClick={() => void handleSend()}
          disabled={!chapterId || loading || !input.trim()}
          className="w-full rounded-sm"
          data-testid="thad-chat-send"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Thinking...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send To THAD
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
