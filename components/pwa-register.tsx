"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let disposed = false;
    const register = () => {
      if (disposed) {
        return;
      }

      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // PWA support is optional; the app remains fully usable without it.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      disposed = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
