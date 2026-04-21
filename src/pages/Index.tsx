import { useEffect, useRef, useState } from "react";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { Studio } from "@/components/Studio";
import { HowItWorks } from "@/components/HowItWorks";
import { HistoryGrid } from "@/components/HistoryGrid";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const studioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const scrollToStudio = () => {
    document.getElementById("studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out.");
  };

  return (
    <div id="top" className="min-h-screen">
      <Navbar user={user} onSignOut={signOut} />
      <Hero onLaunch={scrollToStudio} />
      <div ref={studioRef}>
        <Studio user={user} onHistoryChanged={() => setHistoryKey((k) => k + 1)} />
      </div>
      <HowItWorks />
      <HistoryGrid user={user} refreshKey={historyKey} />
      <Footer />
    </div>
  );
};

export default Index;
