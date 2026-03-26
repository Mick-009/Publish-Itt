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
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // API Handlers
  const handleGenerateIdeas = async () => {
    setLoading(true);
    try {
      const res = await marketApi.generateBookIdeas(universe, ideaCount);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Failed to generate ideas");
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
      toast.error("Failed to analyze market");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerResearch = async () => {
    if (!bookIdea.trim()) {
      toast.error("Please enter a book idea");
      return;
    }
    setLoading(true);
    try {
      const res = await marketApi.customerResearch(bookIdea);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Failed to generate research");
    } finally {
      setLoading(false);
    }
  };

  const handleMarketOutline = async () => {
    if (!bookIdea.trim()) {
      toast.error("Please enter a book idea");
      return;
    }
    setLoading(true);
    try {
      const res = await marketApi.generateMarketOutline(bookIdea, chapterCount);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Failed to generate outline");
    } finally {
      setLoading(false);
    }
  };

  const handleManuscriptDraft = async () => {
    if (!bookIdea.trim()) {
      toast.error("Please enter a book idea");
      return;
    }
    setLoading(true);
    try {
      const res = await marketApi.generateManuscriptDraft(bookIdea, wordCount);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Failed to generate manuscript draft");
    } finally {
      setLoading(false);
    }
  };

  const handleBookDescription = async () => {
    if (!bookTitle.trim() || !bookSummary.trim()) {
      toast.error("Please enter both title and summary");
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
      toast.error("Failed to generate description");
    } finally {
      setLoading(false);
    }
  };

  const handleSalesAnalysis = async () => {
    if (!salesData.trim()) {
      toast.error("Please enter sales data");
      return;
    }
    setLoading(true);
    try {
      const res = await marketApi.analyzeSales(salesData);
      setResponse(res.data.response);
    } catch (error) {
      toast.error("Failed to analyze sales");
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
          Publishing Insights
        </h1>
        <p className="mt-2 text-muted-foreground">
          Discover book ideas with strong market potential
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Insight Tools
            </CardTitle>
            <CardDescription>
              Select a tool and configure your research parameters
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
                  Research
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
                  Description
                </TabsTrigger>
                <TabsTrigger value="sales" className="text-xs px-2 py-1.5">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Sales
                </TabsTrigger>
              </TabsList>

              {/* Book Ideas Tab */}
              <TabsContent value="ideas" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Story World</Label>
                  <Input
                    value={universe}
                    onChange={(e) => setUniverse(e.target.value)}
                    placeholder="e.g., The Dragon Chronicles"
                    className="rounded-sm"
                    data-testid="universe-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of Ideas</Label>
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
                  Generate Book Ideas
                </Button>
              </TabsContent>

              {/* Market Analysis Tab */}
              <TabsContent value="market" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Genre/Category</Label>
                  <Input
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="e.g., children's financial literacy"
                    className="rounded-sm"
                    data-testid="genre-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Age Group (optional)</Label>
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
                        3-5 years (Early Readers)
                      </SelectItem>
                      <SelectItem value="6-8 years">
                        6-8 years (Beginning Readers)
                      </SelectItem>
                      <SelectItem value="8-12 years">
                        8-12 years (Middle Grade)
                      </SelectItem>
                      <SelectItem value="12-18 years">
                        12-18 years (Young Adult)
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
                  Analyze Market
                </Button>
              </TabsContent>

              {/* Customer Research Tab */}
              <TabsContent value="research" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Book Idea</Label>
                  <Textarea
                    value={bookIdea}
                    onChange={(e) => setBookIdea(e.target.value)}
                    placeholder="Describe your book idea in detail..."
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
                  Generate Customer Research
                </Button>
              </TabsContent>

              {/* Market Outline Tab */}
              <TabsContent value="outline" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Book Idea</Label>
                  <Textarea
                    value={bookIdea}
                    onChange={(e) => setBookIdea(e.target.value)}
                    placeholder="Describe your book idea..."
                    className="rounded-sm resize-none min-h-[100px]"
                    data-testid="outline-idea-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of Chapters</Label>
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
                  Generate Market-Aligned Outline
                </Button>
              </TabsContent>

              {/* Manuscript Draft Tab */}
              <TabsContent value="draft" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Book Idea</Label>
                  <Textarea
                    value={bookIdea}
                    onChange={(e) => setBookIdea(e.target.value)}
                    placeholder="Describe your book idea..."
                    className="rounded-sm resize-none min-h-[100px]"
                    data-testid="draft-idea-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Word Count</Label>
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
                        10,000 words (Picture Book)
                      </SelectItem>
                      <SelectItem value="20000">
                        20,000 words (Chapter Book)
                      </SelectItem>
                      <SelectItem value="30000">
                        30,000 words (Middle Grade)
                      </SelectItem>
                      <SelectItem value="50000">
                        50,000 words (Young Adult)
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
                  Generate Manuscript Outline
                </Button>
              </TabsContent>

              {/* Book Description Tab */}
              <TabsContent value="description" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Book Title</Label>
                  <Input
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="Enter book title"
                    className="rounded-sm"
                    data-testid="book-title-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Book Summary</Label>
                  <Textarea
                    value={bookSummary}
                    onChange={(e) => setBookSummary(e.target.value)}
                    placeholder="Brief summary of the book..."
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
                  Generate Sales Description
                </Button>
              </TabsContent>

              {/* Sales Analysis Tab */}
              <TabsContent value="sales" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Sales Data</Label>
                  <Textarea
                    value={salesData}
                    onChange={(e) => setSalesData(e.target.value)}
                    placeholder="Paste your sales data here (e.g., monthly sales figures, revenue by title, channel performance)..."
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
                  Analyze Sales Data
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
                Results
              </CardTitle>
              <CardDescription>AI-generated market insights</CardDescription>
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
                <div className="flex flex-col items-center justify-center h-[400px]">
                  <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Generating insights...
                  </p>
                </div>
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
                    Select a research tool and generate insights to discover
                    market opportunities.
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
