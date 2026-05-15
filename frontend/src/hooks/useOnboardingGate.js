import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onboardingApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/**
 * useOnboardingGate
 *
 * Checks the user's onboarding_complete flag once on mount (and on auth
 * change), and redirects to /onboarding if the user is authenticated but
 * hasn't finished.
 *
 * Mount this once at the App level, inside the auth provider but above
 * the route definitions. It returns a `ready` boolean — render children
 * only when `ready === true` to avoid the flash of dashboard before redirect.
 *
 * The gate is a no-op when:
 * - The user isn't authenticated (auth pages don't need this check)
 * - The user is already on /onboarding (avoid infinite redirect)
 * - The user is already on /auth (login flow has its own routing)
 *
 * If the status fetch fails (network blip, server hiccup), we treat the
 * user as complete and let them through. We'd rather skip onboarding by
 * mistake than block the whole app on a flaky status call.
 */
export function useOnboardingGate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Routes that bypass the gate
    const path = location.pathname;
    const isExempt =
      path.startsWith("/auth") ||
      path.startsWith("/onboarding");

    if (!isAuthenticated) {
      // Unauthenticated routes don't need gating — assume the auth router
      // will handle whatever's needed.
      setReady(true);
      return;
    }

    if (isExempt) {
      setReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await onboardingApi.getStatus();
        if (cancelled) return;
        if (!res.data?.onboarding_complete) {
          navigate("/onboarding", { replace: true });
          // Don't set ready — the navigate will trigger a re-render at /onboarding
        } else {
          setReady(true);
        }
      } catch (err) {
        console.warn("Onboarding gate check failed — letting through:", err);
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, location.pathname]);

  return { ready };
}
