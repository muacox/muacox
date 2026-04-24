import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const STYLE_ID = "muacox-active-theme";

const inject = (css: string) => {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    el.setAttribute("data-origin", "design-ai");
    document.head.appendChild(el);
  }
  el.textContent = css || "";
};

/**
 * Loads the currently active site_themes row and injects its CSS into a global
 * <style> tag at the end of <head>. Listens to realtime changes so when the
 * admin activates a new theme it propagates instantly to every open browser.
 */
export const useSiteTheme = () => {
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase
        .from("site_themes")
        .select("css")
        .eq("is_active", true)
        .maybeSingle();
      if (!mounted) return;
      inject(data?.css || "");
    };

    load();

    const ch = supabase
      .channel("site-theme-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_themes" }, load)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);
};
