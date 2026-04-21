import { Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

interface Props {
  user: User | null;
  onSignOut: () => void;
}

export const Navbar = ({ user, onSignOut }: Props) => {
  const navigate = useNavigate();
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <a href="#top" className="flex items-center gap-2 rounded-full glass px-3 py-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold">LumenAI</span>
        </a>
        <nav className="hidden items-center gap-1 rounded-full glass px-2 py-1 md:flex">
          <a href="#studio" className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-white/5 hover:text-foreground">Studio</a>
          <a href="#how" className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-white/5 hover:text-foreground">How it works</a>
          {user && <a href="#history" className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-white/5 hover:text-foreground">History</a>}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button size="sm" variant="ghost" onClick={onSignOut} className="rounded-full glass text-xs">
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
            </Button>
          ) : (
            <Button size="sm" onClick={() => navigate("/auth")} className="rounded-full bg-gradient-primary text-primary-foreground text-xs shadow-glow">
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
