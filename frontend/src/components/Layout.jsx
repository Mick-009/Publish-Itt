import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import AskThadDialog from "@/components/AskThadDialog";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FileText, label: "Manuscript", path: "/manuscript" },
  { icon: GitBranch, label: "Writing Stage", path: "/workflow" },
  { icon: Palette, label: "Voice & Style", path: "/tone" },
  { icon: ImageIcon, label: "Cover & Art", path: "/art" },
  { icon: TrendingUp, label: "Publishing Insights", path: "/market" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(true);
  const [askThadOpen, setAskThadOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("collapsed");
      if (saved !== null) {
        setCollapsed(JSON.parse(saved));
      }
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
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-card border-r border-border sidebar-transition",
          collapsed ? "w-16" : "w-64",
        )}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border">
          <Feather className="h-6 w-6 text-accent shrink-0" />
          {!collapsed && (
            <span className="ml-3 font-serif text-xl font-medium tracking-tight">
              Publish Itt
            </span>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Ask Thad Button */}
        <div className="p-3 border-t border-border">
          <Button
            onClick={() => setAskThadOpen(true)}
            className={cn(
              "w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm",
              collapsed && "px-0",
            )}
            data-testid="ask-thad-btn"
          >
            <MessageCircle className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Ask Thad</span>}
          </Button>
        </div>

        {/* Collapse Toggle */}
        <Separator />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="m-2 rounded-sm"
          data-testid="collapse-sidebar-btn"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Ask Thad Dialog */}
      <AskThadDialog open={askThadOpen} onOpenChange={setAskThadOpen} />
    </div>
  );
}
