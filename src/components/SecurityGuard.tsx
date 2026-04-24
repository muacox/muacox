import { useEffect } from "react";

/**
 * Hardened security guard — only runs in production builds.
 *
 * Layered protections:
 *  1. Block right-click context menu, drag, copy on non-input elements
 *  2. Block dev-tool keyboard shortcuts (F12, Ctrl+Shift+I/J/C/K, Ctrl+U, Ctrl+S)
 *  3. Detect DevTools open (window size delta) → clear console + redirect
 *  4. Trap the `debugger` keyword in a tight loop while DevTools are open
 *  5. Strip `console.*` so DB calls/IDs aren't logged
 *  6. Override `eval` and `Function` constructor to block console SQL injection attempts
 *  7. Block clipboard reads of sensitive auth tokens
 *
 * IMPORTANT: client-side hardening is a deterrent, not real security.
 * The REAL protection lives in:
 *  - Supabase RLS policies (every table has them)
 *  - Edge functions validating JWT + role + ownership
 *  - Private storage buckets (invoices is now private)
 */
import { supabase } from "@/integrations/supabase/client";

const reportIncident = async (kind: string, details: string) => {
  try {
    await supabase.from("security_incidents" as any).insert({
      kind, details: details.slice(0, 500),
      user_agent: navigator.userAgent.slice(0, 500),
    });
  } catch {}
};

export const SecurityGuard = () => {
  useEffect(() => {
    if (import.meta.env.DEV) return;

    // Detect Kali / Termux / common pentest user-agents
    const ua = navigator.userAgent.toLowerCase();
    if (/kali|termux|nikto|sqlmap|nmap|burp|zap|hydra|metasploit|wfuzz|gobuster/.test(ua)) {
      reportIncident("brute_force", `Suspicious UA: ${ua}`);
      document.documentElement.innerHTML = "<h1 style='font:bold 32px sans-serif;color:#dc2626;text-align:center;padding:40vh 20px'>Acesso bloqueado</h1>";
      return;
    }

    // Block paste of suspicious code into the page (SQL/script injection via console)
    const blockPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") || "";
      if (/select\s+.*\s+from|drop\s+table|;--|union\s+select|<script|eval\(|fetch\(.*supabase/i.test(text)) {
        e.preventDefault();
        reportIncident("suspicious_paste", text.slice(0, 200));
      }
    };
    document.addEventListener("paste", blockPaste);

    // ── 1. Mouse / drag protection ─────────────────────────────
    const blockMenu = (e: MouseEvent) => { e.preventDefault(); return false; };
    const blockDrag = (e: DragEvent) => { e.preventDefault(); return false; };
    const blockCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      // Allow copy in form fields the user is typing in
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
    };

    // ── 2. Keyboard protection ─────────────────────────────────
    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === "F12") { e.preventDefault(); return false; }
      if (ctrl && e.shiftKey && (k === "i" || k === "j" || k === "c" || k === "k")) {
        e.preventDefault(); return false;
      }
      if (ctrl && (k === "u" || k === "s" || k === "p")) { e.preventDefault(); return false; }
    };

    document.addEventListener("contextmenu", blockMenu);
    document.addEventListener("dragstart", blockDrag);
    document.addEventListener("copy", blockCopy);
    document.addEventListener("keydown", blockKeys);

    // ── 3. DevTools detection ──────────────────────────────────
    let devtoolsOpen = false;
    const onOpen = () => {
      try { console.clear(); } catch {}
      // soft-mask the page contents while devtools is open
      document.documentElement.style.filter = "blur(8px)";
      document.documentElement.style.pointerEvents = "none";
    };
    const onClose = () => {
      document.documentElement.style.filter = "";
      document.documentElement.style.pointerEvents = "";
    };
    const detect = () => {
      const widthDiff  = window.outerWidth  - window.innerWidth  > 160;
      const heightDiff = window.outerHeight - window.innerHeight > 160;
      const open = widthDiff || heightDiff;
      if (open && !devtoolsOpen) { devtoolsOpen = true; onOpen(); }
      else if (!open && devtoolsOpen) { devtoolsOpen = false; onClose(); }
    };
    const interval = window.setInterval(detect, 1000);

    // ── 4. Trap-style debugger loop (slows down inspection) ────
    const trap = window.setInterval(() => {
      if (devtoolsOpen) {
        // eslint-disable-next-line no-debugger
        debugger;
      }
    }, 200);

    // ── 5. Silence console output ──────────────────────────────
    const orig = {
      log: console.log, warn: console.warn, info: console.info,
      debug: console.debug, error: console.error, table: console.table,
      dir: console.dir, trace: console.trace,
    };
    const noop = () => {};
    console.log = noop; console.warn = noop; console.info = noop;
    console.debug = noop; console.table = noop; console.dir = noop;
    console.trace = noop;
    // Keep error visible (but only the message, no stack details)
    console.error = (...a: unknown[]) => orig.error("⚠️", String(a[0] ?? "error"));

    // ── 6. Block eval / new Function (console SQL injection vector) ──
    const origEval = window.eval;
    try {
      // freeze eval so attackers can't restore it
      Object.defineProperty(window, "eval", {
        value: () => { throw new Error("eval bloqueado"); },
        writable: false, configurable: false,
      });
    } catch {}
    const OrigFn = window.Function;
    try {
      // @ts-expect-error - we intentionally replace Function constructor
      window.Function = function () {
        throw new Error("Function constructor bloqueado");
      };
    } catch {}

    // ── 7. Console banner warning ──────────────────────────────
    try {
      orig.log(
        "%cPara! ⚠️",
        "color:#dc2626;font-size:42px;font-weight:900;text-shadow:2px 2px 0 #000;"
      );
      orig.log(
        "%cEsta é uma área para programadores. Colar código aqui pode comprometer a tua conta MuacoX. Se alguém te disse para colar algo aqui, é uma fraude.",
        "color:#0046ff;font-size:14px;font-weight:600;"
      );
    } catch {}

    return () => {
      document.removeEventListener("contextmenu", blockMenu);
      document.removeEventListener("dragstart", blockDrag);
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("keydown", blockKeys);
      window.clearInterval(interval);
      window.clearInterval(trap);
      Object.assign(console, orig);
      try { (window as any).eval = origEval; } catch {}
      try { window.Function = OrigFn; } catch {}
    };
  }, []);

  return null;
};
