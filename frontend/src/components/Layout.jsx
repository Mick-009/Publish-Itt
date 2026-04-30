import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  FileText,
  GitBranch,
  Palette,
  ImageIcon,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Feather,
  LogOut,
  User,
  Sparkles,
} from "lucide-react";
import AskThadDialog from "@/components/AskThadDialog";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart2 } from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", exact: true },
  { icon: FileText, label: "Manuscript", path: "/manuscript" },
  { icon: BarChart2, label: "Writing Stats", path: "/stats" },
  { icon: GitBranch, label: "Writing Stage", path: "/workflow" },
  { icon: Palette, label: "Voice & Style", path: "/tone" },
  { icon: ImageIcon, label: "Cover & Art", path: "/art" },
  { icon: TrendingUp, label: "Publishing Insights", path: "/market" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

function NavItem({ item, collapsed }) {
  const location = useLocation();
  const isActive = item.exact
    ? location.pathname === item.path
    : location.pathname === item.path ||
      location.pathname.startsWith(item.path + "/");

  const inner = (
    <NavLink
      to={item.path}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-accent/10 text-accent"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {/* Active left-bar indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r-full" />
      )}
      <item.icon
        className={cn("h-5 w-5 shrink-0", isActive ? "text-accent" : "")}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return inner;
}

function UserMenu({ collapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.display_name
    ? user.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user?.email?.[0]?.toUpperCase() ?? "?");

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const trigger = (
    <button
      className={cn(
        "flex items-center gap-2 w-full rounded-sm px-2 py-2 text-sm",
        "hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">
        {initials}
      </span>
      {!collapsed && (
        <span className="truncate text-left leading-tight">
          <span className="block text-sm font-medium text-foreground truncate max-w-[130px]">
            {user?.display_name || "Writer"}
          </span>
          <span className="block text-xs text-muted-foreground truncate max-w-[130px]">
            {user?.email}
          </span>
        </span>
      )}
    </button>
  );

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium truncate">
            {user?.display_name || "Writer"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.email}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <User className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{menu}</div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {user?.display_name || user?.email}
        </TooltipContent>
      </Tooltip>
    );
  }
  return menu;
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(true);
  const [askThadOpen, setAskThadOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("collapsed");
      if (saved !== null) setCollapsed(JSON.parse(saved));
    } catch (e) {
      console.error("Sidebar load error:", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("collapsed", JSON.stringify(collapsed));
    } catch (e) {
      console.error("Sidebar save error:", e);
    }
  }, [collapsed]);

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-screen overflow-hidden">
        {/* ── Sidebar ── */}
        <aside
          className={cn(
            "flex flex-col bg-card border-r border-border sidebar-transition",
            collapsed ? "w-[60px]" : "w-64",
          )}
          data-testid="sidebar"
        >
          {/* Logo */}
          <div
            className={cn(
              "flex items-center h-16 border-b border-border",
              collapsed ? "justify-center px-0" : "px-5 gap-3",
            )}
          >
            <Feather className="h-5 w-5 text-accent shrink-0" />
            {!collapsed && (
              <span className="font-serif text-lg font-semibold tracking-tight">
                Publish Itt
              </span>
            )}
          </div>

          {/* Nav */}
          <ScrollArea className="flex-1 py-3">
            <nav className={cn("space-y-0.5", collapsed ? "px-1.5" : "px-2")}>
              {navItems.map((item) => (
                <NavItem key={item.path} item={item} collapsed={collapsed} />
              ))}
            </nav>
          </ScrollArea>

          {/* Ask Thad */}
          <div
            className={cn(
              "py-3 border-t border-border",
              collapsed ? "px-1.5" : "px-2",
            )}
          >
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setAskThadOpen(true)}
                    size="icon"
                    className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm"
                    data-testid="ask-thad-btn"
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Ask Thad
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                onClick={() => setAskThadOpen(true)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm justify-start gap-2"
                data-testid="ask-thad-btn"
              >
                <Sparkles className="h-4 w-4" />
                <span>Ask Thad</span>
              </Button>
            )}
          </div>

          {/* User menu */}
          <div
            className={cn(
              "border-t border-border py-2",
              collapsed ? "px-1.5" : "px-2",
            )}
          >
            <UserMenu collapsed={collapsed} />
          </div>

          {/* Collapse toggle */}
          <Separator />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "m-1.5 rounded-sm text-muted-foreground hover:text-foreground",
              !collapsed && "justify-start gap-2",
            )}
            data-testid="collapse-sidebar-btn"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        <AskThadDialog open={askThadOpen} onOpenChange={setAskThadOpen} />
      </div>
    </TooltipProvider>
  );
}
