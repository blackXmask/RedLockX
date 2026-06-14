import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { SpiderWeb } from "@/components/spider-web";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Analyzer from "@/pages/analyzer";
import Dashboard from "@/pages/dashboard";
import Logs from "@/pages/logs";
import Chat from "@/pages/chat";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function AppShell() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.body.classList.add("scanlines");
  }, []);

  return (
    <Layout>
      <Switch>
        <Route path="/app" component={Analyzer} />
        <Route path="/app/chat" component={Chat} />
        <Route path="/app/dashboard" component={Dashboard} />
        <Route path="/app/logs" component={Logs} />
        <Route path="/app/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  const [location] = useLocation();
  const isApp = location.startsWith("/app");

  useEffect(() => {
    if (isApp) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("scanlines");
    } else {
      document.documentElement.classList.add("dark");
      document.body.classList.remove("scanlines");
    }
  }, [isApp]);

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/app" component={AppShell} />
      <Route path="/app/:rest*" component={AppShell} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <SpiderWeb />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
