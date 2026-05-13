import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { statsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  Flame, 
  Clock, 
  FileText, 
  TrendingUp,
  Calendar,
  Target,
  Loader2,
  BarChart3,
  Zap,
  Sparkles,
  RefreshCw,
  ArrowRight,
  RotateCcw,
  Edit2,
  Bell
} from "lucide-react";

// Constants for localStorage keys
const DAILY_GOALS_KEY = "publish_itt_daily_goals";
const LAST_ACTIVE_KEY = "publish_itt_last_active";

// Default goals structure
const DEFAULT_GOALS = {
  wordCountGoal: 500,
  timeGoal: 30, // minutes
  customTargets: [],
  lastResetDate: null,
  lastActiveTimestamp: null
};

// Helper to get today's date string in user's local timezone
const getTodayDateString = () => {
  return new Date().toLocaleDateString('en-CA'); // Returns YYYY-MM-DD format
};

// Helper to check if 24 hours have passed since last activity
const hasBeenInactiveFor24Hours = (lastActiveTimestamp) => {
  if (!lastActiveTimestamp) return true;
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return (now - lastActiveTimestamp) >= twentyFourHours;
};

export default function WritingStatsPanel({ className, ageGroup, autoAnalyzeOnMount = true }) {
  const [stats, setStats] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Daily goals state
  const [dailyGoals, setDailyGoals] = useState(DEFAULT_GOALS);
  const [showGoalResetNotification, setShowGoalResetNotification] = useState(false);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [editWordGoal, setEditWordGoal] = useState(500);
  const [editTimeGoal, setEditTimeGoal] = useState(30);
  
  // Momentum state
  const [momentumData, setMomentumData] = useState(null);
  const [momentumLoading, setMomentumLoading] = useState(false);
  const [lastMomentumCheck, setLastMomentumCheck] = useState(null);

  // Load and check daily goals on mount
  useEffect(() => {
    const savedGoals = localStorage.getItem(DAILY_GOALS_KEY);
    const today = getTodayDateString();
    
    if (savedGoals) {
      const parsed = JSON.parse(savedGoals);
      const lastResetDate = parsed.lastResetDate;
      const lastActiveTimestamp = parsed.lastActiveTimestamp;
      
      // Check if reset is needed
      const isNewDay = lastResetDate !== today;
      const isInactive24Hours = hasBeenInactiveFor24Hours(lastActiveTimestamp);
      
      if (isNewDay || isInactive24Hours) {
        // Reset goals
        performGoalReset(isNewDay ? "new_day" : "inactivity");
      } else {
        // Load existing goals
        setDailyGoals(parsed);
      }
    } else {
      // First time user - initialize with defaults
      const initialGoals = {
        ...DEFAULT_GOALS,
        lastResetDate: today,
        lastActiveTimestamp: Date.now()
      };
      setDailyGoals(initialGoals);
      localStorage.setItem(DAILY_GOALS_KEY, JSON.stringify(initialGoals));
    }
    
    // Update last active timestamp
    updateLastActive();
    
    // Load stats
    loadStats();
  }, []);

  // Update last active timestamp periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateLastActive();
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  // Check for midnight reset
  useEffect(() => {
    const checkMidnight = () => {
      const today = getTodayDateString();
      if (dailyGoals.lastResetDate && dailyGoals.lastResetDate !== today) {
        performGoalReset("new_day");
      }
    };
    
    // Check every minute for midnight crossing
    const interval = setInterval(checkMidnight, 60000);
    
    return () => clearInterval(interval);
  }, [dailyGoals.lastResetDate]);

  const updateLastActive = () => {
    const today = getTodayDateString();
    setDailyGoals(prev => {
      const updated = {
        ...prev,
        lastActiveTimestamp: Date.now(),
        lastResetDate: prev.lastResetDate || today
      };
      localStorage.setItem(DAILY_GOALS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const performGoalReset = (reason) => {
    const today = getTodayDateString();
    const resetGoals = {
      wordCountGoal: DEFAULT_GOALS.wordCountGoal,
      timeGoal: DEFAULT_GOALS.timeGoal,
      customTargets: [],
      lastResetDate: today,
      lastActiveTimestamp: Date.now()
    };
    
    setDailyGoals(resetGoals);
    localStorage.setItem(DAILY_GOALS_KEY, JSON.stringify(resetGoals));
    setShowGoalResetNotification(true);
    
    // Log reset reason for debugging
    console.log(`Daily goals reset due to: ${reason}`);
  };

  const saveGoals = () => {
    const today = getTodayDateString();
    const updated = {
      ...dailyGoals,
      wordCountGoal: editWordGoal,
      timeGoal: editTimeGoal,
      lastResetDate: today,
      lastActiveTimestamp: Date.now()
    };
    
    setDailyGoals(updated);
    localStorage.setItem(DAILY_GOALS_KEY, JSON.stringify(updated));
    setShowGoalDialog(false);
    toast.success("Goals set.");
  };

  const openGoalDialog = () => {
    setEditWordGoal(dailyGoals.wordCountGoal);
    setEditTimeGoal(dailyGoals.timeGoal);
    setShowGoalDialog(true);
  };

  const loadStats = async () => {
    try {
      const [overviewRes, weeklyRes] = await Promise.all([
        statsApi.getOverview(),
        statsApi.getWeekly()
      ]);
      setStats(overviewRes.data);
      setWeeklyData(weeklyRes.data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get momentum analysis from Thad
  const loadMomentum = useCallback(async () => {
    if (!stats) return;
    
    setMomentumLoading(true);
    try {
      const todayWords = getTodayWords();
      const weeklyWords = weeklyData.reduce((sum, d) => sum + (d.words || 0), 0);
      const totalTime = stats?.total_time_seconds || 0;
      const sessionMinutes = Math.round(totalTime / 60);
      
      // Calculate time away (simplified)
      const timeAway = stats?.last_writing_date 
        ? `Last wrote on ${stats.last_writing_date}` 
        : "First time writing";
      
      const response = await statsApi.getMomentum(
        todayWords,
        weeklyWords,
        stats?.current_streak || 0,
        stats?.total_words_written || 0,
        sessionMinutes,
        timeAway,
        null, // goals
        ageGroup
      );
      
      setMomentumData(response.data);
      setLastMomentumCheck(Date.now());
    } catch (error) {
      console.error("Failed to load momentum:", error);
      // Fallback in voice — used when the API is unreachable.
      setMomentumData({
        message: "Couldn't reach the read. Keep going — the page is still there.",
        suggestions: ["Open a chapter", "Set a small target"]
      });
    } finally {
      setMomentumLoading(false);
    }
  }, [stats, weeklyData, ageGroup]);

  // Auto-load momentum when stats are available
  useEffect(() => {
    if (autoAnalyzeOnMount && stats && !momentumData && !momentumLoading) {
      loadMomentum();
    }
  }, [autoAnalyzeOnMount, stats, momentumData, momentumLoading, loadMomentum]);

  const formatTime = (seconds) => {
    if (!seconds) return "0m";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getTodayWords = () => {
    if (!weeklyData.length) return 0;
    const today = weeklyData[weeklyData.length - 1];
    return today?.words || 0;
  };

  const getMaxWeeklyWords = () => {
    if (!weeklyData.length) return dailyGoals.wordCountGoal;
    return Math.max(...weeklyData.map(d => d.words), dailyGoals.wordCountGoal);
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-32", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const todayWords = getTodayWords();
  const dailyProgress = Math.min((todayWords / dailyGoals.wordCountGoal) * 100, 100);
  const maxWords = getMaxWeeklyWords();

  return (
    <div className={cn("space-y-4", className)} data-testid="writing-stats-panel">
      {/* Goal Reset Notification */}
      {showGoalResetNotification && (
        <Card className="border-l-4 border-l-blue-500 bg-blue-500/5" data-testid="goal-reset-notification">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-sm bg-blue-500/20 shrink-0">
                <RotateCcw className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1">New day, fresh goals.</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Goals reset for the day. Want to change them?
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs rounded-sm"
                    onClick={openGoalDialog}
                    data-testid="set-new-goal-btn"
                  >
                    <Target className="h-3 w-3 mr-1" />
                    Set goals
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs rounded-sm"
                    onClick={() => setShowGoalResetNotification(false)}
                    data-testid="dismiss-notification-btn"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Thad's Momentum Read */}
      <Card className="border-l-4 border-l-accent bg-gradient-to-br from-accent/5 to-transparent" data-testid="momentum-card">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Momentum
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMomentum}
              disabled={momentumLoading}
              className="h-7 px-2 text-xs"
              data-testid="refresh-momentum-btn"
            >
              {momentumLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {momentumLoading && !momentumData ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Checking the run rate.</span>
            </div>
          ) : momentumData ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed" data-testid="momentum-message">
                {momentumData.message}
              </p>
              
              {/* Suggestions */}
              {momentumData.suggestions && momentumData.suggestions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {momentumData.suggestions.map((suggestion, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                      data-testid={`momentum-suggestion-${index}`}
                    >
                      <ArrowRight className="h-3 w-3 text-accent mt-0.5 shrink-0" />
                      <span>{suggestion}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {lastMomentumCheck && (
                <div className="text-[10px] text-muted-foreground pt-1">
                  Updated: {new Date(lastMomentumCheck).toLocaleTimeString()}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Refresh to see the read.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-3">
        {/* Current Streak */}
        <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-sm bg-orange-500/20">
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="streak-count">{stats?.current_streak || 0}</p>
                <p className="text-xs text-muted-foreground">day streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Words */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-sm bg-blue-500/20">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="today-words">{todayWords.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">words today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Goal Progress */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Today's target</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {todayWords} / {dailyGoals.wordCountGoal} words
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={openGoalDialog}
                data-testid="edit-goal-btn"
              >
                <Edit2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          </div>
          <Progress value={dailyProgress} className="h-2" data-testid="daily-progress" />
          {dailyProgress >= 100 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
              <Zap className="h-3 w-3" />
              Goal reached.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Chart */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            This week
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex items-end justify-between gap-1 h-20">
            {weeklyData.map((day, index) => {
              const height = maxWords > 0 ? (day.words / maxWords) * 100 : 0;
              const isToday = index === weeklyData.length - 1;
              
              return (
                <div 
                  key={day.date} 
                  className="flex-1 flex flex-col items-center gap-1"
                  data-testid={`weekly-bar-${day.day}`}
                >
                  <div className="w-full flex flex-col items-center justify-end h-16">
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all",
                        isToday 
                          ? "bg-accent" 
                          : day.words > 0 
                            ? "bg-accent/40" 
                            : "bg-muted"
                      )}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px]",
                    isToday ? "font-bold text-accent" : "text-muted-foreground"
                  )}>
                    {day.day}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 p-2 rounded-sm bg-muted/50">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p className="font-medium" data-testid="total-time">{formatTime(stats?.total_time_seconds || 0)}</p>
            <p className="text-muted-foreground">Time at the desk</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-sm bg-muted/50">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p className="font-medium" data-testid="avg-words">{Math.round(stats?.average_words_per_day || 0)}</p>
            <p className="text-muted-foreground">Avg / day</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-sm bg-muted/50">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p className="font-medium" data-testid="total-words">{(stats?.total_words_written || 0).toLocaleString()}</p>
            <p className="text-muted-foreground">Total words</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-sm bg-muted/50">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p className="font-medium" data-testid="days-active">{stats?.days_active || 0}</p>
            <p className="text-muted-foreground">Days active</p>
          </div>
        </div>
      </div>

      {/* Longest Streak Badge */}
      {stats?.longest_streak > 0 && (
        <div className="flex items-center justify-center">
          <Badge variant="outline" className="text-xs gap-1" data-testid="longest-streak-badge">
            <Flame className="h-3 w-3 text-orange-500" />
            Best streak: {stats.longest_streak} days
          </Badge>
        </div>
      )}

      {/* Set Goals Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="sm:max-w-[400px]" data-testid="goal-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-accent" />
              Today's targets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="word-goal" className="text-sm font-medium">
                Word target
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="word-goal"
                  type="number"
                  min="50"
                  max="10000"
                  step="50"
                  value={editWordGoal}
                  onChange={(e) => setEditWordGoal(parseInt(e.target.value) || 500)}
                  className="rounded-sm"
                  data-testid="word-goal-input"
                />
                <span className="text-sm text-muted-foreground">words</span>
              </div>
              <p className="text-xs text-muted-foreground">
                How many words today?
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="time-goal" className="text-sm font-medium">
                Time target
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="time-goal"
                  type="number"
                  min="5"
                  max="480"
                  step="5"
                  value={editTimeGoal}
                  onChange={(e) => setEditTimeGoal(parseInt(e.target.value) || 30)}
                  className="rounded-sm"
                  data-testid="time-goal-input"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
              <p className="text-xs text-muted-foreground">
                How long today?
              </p>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-sm">
              <p className="font-medium mb-1 flex items-center gap-1">
                <Bell className="h-3 w-3" />
                How resets work
              </p>
              <p>Goals reset at midnight or after 24 hours away.</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGoalDialog(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={saveGoals}
              className="rounded-sm"
              data-testid="save-goals-btn"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
