import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import ManuscriptWorkspace from "@/pages/ManuscriptWorkspace";
import WritingStats from "@/components/WritingStats";
import WorkflowWorkspace from "@/pages/WorkflowWorkspace";
import ToneStyleWorkspace from "@/pages/ToneStyleWorkspace";
import ArtStudio from "@/pages/ArtStudio";
import MarketIntelligence from "@/pages/MarketIntelligence";
import Settings from "@/pages/Settings";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <BrowserRouter>
            <Routes>
              {/* Public route — auth page */}
              <Route path="/auth" element={<AuthPage />} />

              {/* All other routes require a valid session */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route
                    path="manuscript/:projectId?"
                    element={<ManuscriptWorkspace />}
                  />
                  <Route path="stats" element={<WritingStats />} />
                  <Route
                    path="workflow/:projectId?"
                    element={<WorkflowWorkspace />}
                  />
                  <Route
                    path="tone/:projectId?"
                    element={<ToneStyleWorkspace />}
                  />
                  <Route path="art/:projectId?" element={<ArtStudio />} />
                  <Route path="market" element={<MarketIntelligence />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>

              {/* Catch-all — redirect unknown paths to dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="bottom-right" />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
