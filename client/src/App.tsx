import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrandThemeProvider } from "@/components/brand-theme-provider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Book from "@/pages/book";
import HowItWorks from "@/pages/how-it-works";
import Gallery from "@/pages/gallery";
import Events from "@/pages/events";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import Admin from "@/pages/admin";
import Pay from "@/pages/pay";
import PayReturn from "@/pages/pay-return";
import Confirmed from "@/pages/confirmed";
import WidgetOnly from "@/pages/widget-only";
import DynamicPage from "@/pages/dynamic-page";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/book" component={Book} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/events" component={Events} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/widget" component={WidgetOnly} />
      <Route path="/admin" component={Admin} />
      <Route path="/pay/return/:id" component={PayReturn} />
      <Route path="/pay/:id" component={Pay} />
      <Route path="/confirmed/:id" component={Confirmed} />
      <Route path="/p/:slug" component={DynamicPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </BrandThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
