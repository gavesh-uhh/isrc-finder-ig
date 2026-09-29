"use client";

import { InstallIcon } from "@/components/icons";
import { useInstallPrompt } from "@/lib/use-install-prompt";

// Stays hidden on browsers that never fire `beforeinstallprompt`, like iOS Safari and Firefox.
export default function InstallButton() {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!canInstall) {
    return null;
  }

  return (
    <button
      className="pill-link install-button"
      type="button"
      onClick={() => void promptInstall()}
    >
      <InstallIcon />
      <span>Install App</span>
    </button>
  );
}
