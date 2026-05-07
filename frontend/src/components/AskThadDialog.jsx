import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { aiApi } from "@/lib/api";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function AskThadDialog({ open, onOpenChange }) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse("");

    try {
      const res = await aiApi.askThad(query);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Couldn't get through just now. Try again?");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuery("");
    setResponse("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-2xl max-h-[80vh]"
        data-testid="ask-thad-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
            <Sparkles className="h-6 w-6 text-accent" />
            Ask Thad
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Ask anything about your work — a chapter, a paragraph, the whole shape of it."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[100px] resize-none rounded-sm"
            data-testid="ask-thad-input"
          />

          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full rounded-sm"
            data-testid="ask-thad-submit"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reading.
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </form>

        {response && (
          <ScrollArea className="mt-4 max-h-[300px]">
            <div
              className="p-4 bg-muted rounded-sm ai-response prose prose-sm max-w-none"
              data-testid="ask-thad-response"
            >
              <div className="whitespace-pre-wrap">{response}</div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
