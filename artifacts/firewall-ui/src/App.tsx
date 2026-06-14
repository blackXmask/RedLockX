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

function AppPage({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.body.classList.add("scanlines");
  }, []);
  return <Layout>{children}</Layout>;
}

function Routes() {
  const [location] = useLocation();

  useEffect(() => {
    if (location === "/") {
      document.body.classList.remove("scanlines");
    } else {
      document.body.classList.add("scanlines");
    }
  }, [location]);

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/app">
        <AppPage><Analyzer /></AppPage>
      </Route>
      <Route path="/app/chat">
        <AppPage><Chat /></AppPage>
      </Route>
      <Route path="/app/dashboard">
        <AppPage><Dashboard /></AppPage>
      </Route>
      <Route path="/app/logs">
        <AppPage><Logs /></AppPage>
      </Route>
      <Route path="/app/settings">
        <AppPage><Settings /></AppPage>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <SpiderWeb />
          <Routes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
