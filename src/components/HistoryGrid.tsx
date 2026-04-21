import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Item {
  id: string;
  title: string;
  source_type: string;
  thumbnail_url: string | null;
  created_at: string;
}

interface Props {
  user: User | null;
  refreshKey: number;
}

export const HistoryGrid = ({ user, refreshKey }: Props) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("enhancements")
      .select("id,title,source_type,thumbnail_url,created_at")
      .order("created_at", { ascending: false })
      .limit(24);
    if (!error && data) setItems(data as Item[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refreshKey]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("enhancements").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't delete.");
      return;
    }
    setItems((p) => p.filter((i) => i.id !== id));
  };

  if (!user) return null;

  return (
    <section id="history" className="px-4 py-16 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold md:text-3xl">Your history</h2>
          <span className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl glass p-10 text-center">
            <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No saved enhancements yet. Save one from the Studio above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((it) => (
              <div key={it.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-card shadow-card">
                {it.thumbnail_url ? (
                  <img src={it.thumbnail_url} alt={it.title} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="aspect-video w-full bg-muted" />
                )}
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {it.source_type} · {new Date(it.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute right-2 top-2 h-7 w-7 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => remove(it.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
