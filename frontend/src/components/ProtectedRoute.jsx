import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Feather } from "lucide-react";

/**
 * Wraps any route that requires authentication.
 * Shows a loading screen while the token is being verified on first mount,
 * then redirects to /auth if no valid session exists.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Feather className="h-8 w-8 text-accent animate-pulse" />
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
