import IsrcFinder from "@/components/isrc-finder";
import Onboarding from "@/components/onboarding";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "ISRC Finder",
            url: SITE_URL,
            description: SITE_DESCRIPTION,
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Any",
            inLanguage: "en",
            isAccessibleForFree: true,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <IsrcFinder feedbackEnabled={Boolean(process.env.DISCORD?.trim())} />
      <Onboarding />
    </main>
  );
}
