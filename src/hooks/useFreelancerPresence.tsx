import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Marks the current freelancer as online while the tab is active.
 * Sends heartbeats every 30s and flips to offline on unmount.
 */
export const useFreelancerPresence = (userId: string | undefined, enabled: boolean) => {
  useEffect(() => {
    if (!userId || !enabled) return;

    const setOnline = (online: boolean) =>
      supabase.from("freelancers")
        .update({ is_online: online, last_seen: new Date().toISOString() })
        .eq("user_id", userId);

    setOnline(true);
    const beat = window.setInterval(() => setOnline(true), 30_000);

    const onVisibility = () => setOnline(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(beat);
      document.removeEventListener("visibilitychange", onVisibility);
      setOnline(false);
    };
  }, [userId, enabled]);
};
