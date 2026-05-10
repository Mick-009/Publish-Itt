import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { marketApi } from "@/lib/api";
import { toast } from "sonner";
import LoadingState from "@/components/LoadingState";
import {
  Loader2,
  Lightbulb,
  TrendingUp,
  Users,
  FileText,
  BookOpen,
  BarChart3,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";

export default function MarketIntelligence() {
  const [activeTab, setActiveTab] = useState("ideas");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [copied, setCopied] = useState(false);

  // Form states
  const [universe, setUniverse] = useState("");
  const [ideaCount, setIdeaCount] = useState(10);
  const [genre, setGenre] = useState("Lovecraftian Horror");
  const [ageGroup, setAgeGroup] = useState("");
  const [bookIdea, setBookIdea] = useState("");
  const [chapterCount, setChapterCount] = useState(12);
  const [wordCount, setWordCount] = useState(30000);
  const [bookTitle, setBookTitle] = useState("");
  const [bookSummary, setBookSummary] = useState("");
  const [salesData, setSalesData] = useState("");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(response);
    setCopied(true);
    toast.success("Copied.");
    setTimeout(() => setCopied(false), 2000);
  };

  // API Handlers
  const handleGenerateIdeas = async () => {
    setLoading(true);
    try {
      const res = await marketApi.generateBookIdeas(universe, ideaCount);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Couldn't put that together. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const handleMarketAnalysis = async () => {
    setLoading(true);
    try {
      const res = await marketApi.analyzeMarket(genre, ageGroup || null);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Couldn't read the market. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerResearch = async () => {
    if (!bookIdea.trim()) {
      toast.error("Tell me about the book first.");
      return;
    }
    setLoading(true);
    try {
      const res = await marketApi.customerResearch(bookIdea);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Couldn't put that together. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const handleMarketOutline = async () => {
    if (!bookIdea.trim()) {
      toast.error("Tell me about the book first.");
      return;
    }
    setLoading(true);
    try {
      const res = await marketApi.generateMarketOutline(bookIdea, chapterCount);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Couldn't outline that. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const handleManuscriptDraft = async () => {
    if (!bookIdea.trim()) {
      toast.error("Tell me about the book first.");
      return;
    }
    setLoading(true);
    try {
      const res = await marketApi.generateManuscriptDraft(bookIdea, wordCount);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Couldn't draft that. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const handleBookDescription = async () => {
    if (!bookTitle.trim() || !bookSummary.trim()) {
      toast.error("I need a title and a summary.");
      return;
    }
    setLoading(true);
    try {
      const res = await marketApi.generateBookDescription(
        bookTitle,
        bookSummary,
      );
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Couldn't write that. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const handleSalesAnalysis = async () => {
    if (!salesData.trim()) {
      toast.error("Paste your numbers in first.");
      return;
    }
    setLoading(true);
    try {
      const res = await marketApi.analyzeSales(salesData);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Couldn't read those numbers. Try again?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="p-8 lg:p-12 max-w-7xl mx-auto animate-fade-in"
      data-testid="market-intelligence"
    >
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight">
          Out in the world
        </h1>
        <p className="mt-2 text-muted-foreground">
          What's selling, where the gaps are, where your book might land.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              The tools
            </CardTitle>
            <CardDescription>
              Pick one. Tell me what you're chasing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid grid-cols-4 lg:grid-cols-7 gap-1 h-auto p-1">
                <TabsTrigger value="ideas" className="text-xs px-2 py-1.5">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  Ideas
                </TabsTrigger>
                <TabsTrigger value="market" className="text-xs px-2 py-1.5">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Market
                </TabsTrigger>
                <TabsTrigger value="research" className="text-xs px-2 py-1.5">
                  <Users className="h-3 w-3 mr-1" />
                  Readers
                </TabsTrigger>
                <TabsTrigger value="outline" className="text-xs px-2 py-1.5">
                  <FileText className="h-3 w-3 mr-1" />
                  Outline
                </TabsTrigger>
                <TabsTrigger value="draft" className="text-xs px-2 py-1.5">
                  <BookOpen className="h-3 w-3 mr-1" />
                  Draft
                </TabsTrigger>
                <TabsTrigger
                  value="description"
                  className="text-xs px-2 py-1.5"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Blurb
                </TabsTrigger>
                <TabsTrigger value="sales" className="text-xs px-2 py-1.5">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Sales
                </TabsTrigger>
              </TabsList>

              {/* Book Ideas Tab */}
              <TabsContent value="ideas" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>The world it lives in</Label>
                  <Input
                    value={universe}
                    onChange={(e) => setUniverse(e.target.value)}
                    placeholder="e.g., The Dragon Chronicles"
                    className="rounded-sm"
                    data-testid="universe-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>How many ideas</Label>
                  <Select
                    value={ideaCount.toString()}
                    onValueChange={(v) => setIdeaCount(parseInt(v))}
                  >
                    <SelectTrigger
                      className="rounded-sm"
                      data-testid="idea-count-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 ideas</SelectItem>
                      <SelectItem value="10">10 ideas</SelectItem>
                      <SelectItem value="15">15 ideas</SelectItem>
                      <SelectItem value="20">20 ideas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleGenerateIdeas}
                  disabled={loading}
                  className="w-full rounded-sm"
                  data-testid="generate-ideas-btn"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Lightbulb className="h-4 w-4 mr-2" />
                  )}
                  Pitch me some ideas
                </Button>
              </TabsContent>

              {/* Market Analysis Tab */}
              <TabsContent value="market" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Genre or category</Label>
                  <Input
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="e.g., children's financial literacy"
                    className="rounded-sm"
                    data-testid="genre-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age group (optional)</Label>
                  <Select
                    value={ageGroup || "all"}
                    onValueChange={(v) => setAgeGroup(v === "all" ? "" : v)}
                  >
                    <SelectTrigger
                      className="rounded-sm"
                      data-testid="age-group-select"
                    >
                      <SelectValue placeholder="All ages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ages</SelectItem>
                      <SelectItem value="3-5 years">
                        3–5 (early readers)
                      </SelectItem>
                      <SelectItem value="6-8 years">
                        6–8 (beginning readers)
                      </SelectItem>
                      <SelectItem value="8-12 years">
                        8–12 (middle grade)
                      </SelectItem>
                      <SelectItem value="12-18 years">
                        12–18 (young adult)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleMarketAnalysis}
                  disabled={loading}
                  className="w-full rounded-sm"
                  data-testid="analyze-market-btn"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mr-2" />
                  )}
                  Read the market
                </Button>
              </TabsContent>

              {/* Customer Research Tab */}
              <TabsContent value="research" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>The book</Label>
                  <Textarea
                    value={bookIdea}
                    onChange={(e) => setBookIdea(e.target.value)}
                    placeholder="What it's about, who it's for, what makes it different."
                    className="rounded-sm resize-none min-h-[120px]"
                    data-testid="book-idea-input"
                  />
                </div>
                <Button
                  onClick={handleCustomerResearch}
                  disabled={loading || !bookIdea.trim()}
                  className="w-full rounded-sm"
                  data-testid="customer-research-btn"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4 mr-2" />
                  )}
                  Sketch the reader
                </Button>
              </TabsContent>

              {/* Market Outline Tab */}
              <TabsContent value="outline" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>The book</Label>
                  <Textarea
                    value={bookIdea}
                    onChange={(e) => setBookIdea(e.target.value)}
                    placeholder="What it's about."
                    className="rounded-sm resize-none min-h-[100px]"
                    data-testid="outline-idea-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>How many chapters</Label>
                  <Input
                    type="number"
                    min={5}
                    max={30}
                    value={chapterCount}
                    onChange={(e) =>
                      setChapterCount(parseInt(e.target.value) || 12)
                    }
                    className="rounded-sm"
                    data-testid="chapter-count-input"
                  />
                </div>
                <Button
                  onClick={handleMarketOutline}
                  disabled={loading || !bookIdea.trim()}
                  className="w-full rounded-sm"
                  data-testid="generate-outline-btn"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Outline it
                </Button>
              </TabsContent>

              {/* Manuscript Draft Tab */}
              <TabsContent value="draft" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>The book</Label>
                  <Textarea
                    value={bookIdea}
                    onChange={(e) => setBookIdea(e.target.value)}
                    placeholder="What it's about."
                    className="rounded-sm resize-none min-h-[100px]"
                    data-testid="draft-idea-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target length</Label>
                  <Select
                    value={wordCount.toString()}
                    onValueChange={(v) => setWordCount(parseInt(v))}
                  >
                    <SelectTrigger
                      className="rounded-sm"
                      data-testid="word-count-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10000">
                        10,000 words (picture book)
                      </SelectItem>
                      <SelectItem value="20000">
                        20,000 words (chapter book)
                      </SelectItem>
                      <SelectItem value="30000">
                        30,000 words (middle grade)
                      </SelectItem>
                      <SelectItem value="50000">
                        50,000 words (young adult)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleManuscriptDraft}
                  disabled={loading || !bookIdea.trim()}
                  className="w-full rounded-sm"
                  data-testid="generate-draft-btn"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BookOpen className="h-4 w-4 mr-2" />
                  )}
                  Sketch a draft
                </Button>
              </TabsContent>

              {/* Book Description Tab */}
              <TabsContent value="description" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="What it's called."
                    className="rounded-sm"
                    data-testid="book-title-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Summary</Label>
                  <Textarea
                    value={bookSummary}
                    onChange={(e) => setBookSummary(e.target.value)}
                    placeholder="A few sentences on what it's about."
                    className="rounded-sm resize-none min-h-[100px]"
                    data-testid="book-summary-input"
                  />
                </div>
                <Button
                  onClick={handleBookDescription}
                  disabled={loading || !bookTitle.trim() || !bookSummary.trim()}
                  className="w-full rounded-sm"
                  data-testid="generate-description-btn"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Write the back-cover blurb
                </Button>
              </TabsContent>

              {/* Sales Analysis Tab */}
              <TabsContent value="sales" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>The numbers</Label>
                  <Textarea
                    value={salesData}
                    onChange={(e) => setSalesData(e.target.value)}
                    placeholder="Paste sales — month by month, by title, by channel, however you've got it."
                    className="rounded-sm resize-none min-h-[150px]"
                    data-testid="sales-data-input"
                  />
                </div>
                <Button
                  onClick={handleSalesAnalysis}
                  disabled={loading || !salesData.trim()}
                  className="w-full rounded-sm"
                  data-testid="analyze-sales-btn"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BarChart3 className="h-4 w-4 mr-2" />
                  )}
                  Read the numbers
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card className="lg:row-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-serif flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                What I found
              </CardTitle>
              <CardDescription>The market, in plain sight.</CardDescription>
            </div>
            {response && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="rounded-sm"
                data-testid="copy-results-btn"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {loading ? (
                <LoadingState
                  size="panel"
                  title="Reading the market."
                  body="Cross-checking what's selling, what's missing, and where you'd fit."
                  testId="loading-market-results"
                />
              ) : response ? (
                <div
                  className="ai-response prose prose-sm max-w-none whitespace-pre-wrap"
                  data-testid="market-results"
                >
                  {response}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm text-center">
                    Pick a tool. I'll go read.
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
