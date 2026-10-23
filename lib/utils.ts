import { interviewCovers, mappings } from "@/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const techIconBaseURL = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons";

const normalizeTechName = (tech: string) => {
  const key = tech.toLowerCase().replace(/\.js$/, "").replace(/\s+/g, "");
  return mappings[key as keyof typeof mappings];
};

const checkIconExists = async (url: string) => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok; // Returns true if the icon exists
  } catch {
    return false;
  }
};

export const getTechLogos = async (techArray: string[]) => {
  const logoURLs = techArray.map((tech) => {
    const normalized = normalizeTechName(tech);
    return {
      tech,
      url: `${techIconBaseURL}/${normalized}/${normalized}-original.svg`,
    };
  });

  const results = await Promise.all(
    logoURLs.map(async ({ tech, url }) => ({
      tech,
      url: (await checkIconExists(url)) ? url : "/tech.svg",
    }))
  );

  return results;
};

const KNOWN_COMPANIES: Record<string, { domain?: string; localCover?: string }> = {
  adobe: { localCover: "/covers/adobe.png", domain: "adobe.com" },
  amazon: { localCover: "/covers/amazon.png", domain: "amazon.com" },
  facebook: { localCover: "/covers/facebook.png", domain: "meta.com" },
  meta: { localCover: "/covers/facebook.png", domain: "meta.com" },
  hostinger: { localCover: "/covers/hostinger.png", domain: "hostinger.com" },
  pinterest: { localCover: "/covers/pinterest.png", domain: "pinterest.com" },
  quora: { localCover: "/covers/quora.png", domain: "quora.com" },
  reddit: { localCover: "/covers/reddit.png", domain: "reddit.com" },
  skype: { localCover: "/covers/skype.png", domain: "skype.com" },
  spotify: { localCover: "/covers/spotify.png", domain: "spotify.com" },
  telegram: { localCover: "/covers/telegram.png", domain: "telegram.org" },
  tiktok: { localCover: "/covers/tiktok.png", domain: "tiktok.com" },
  yahoo: { localCover: "/covers/yahoo.png", domain: "yahoo.com" },
  google: { domain: "google.com" },
  microsoft: { domain: "microsoft.com" },
  apple: { domain: "apple.com" },
  netflix: { domain: "netflix.com" },
  uber: { domain: "uber.com" },
  twitter: { domain: "x.com" },
  x: { domain: "x.com" },
  github: { domain: "github.com" },
  gitlab: { domain: "gitlab.com" },
  stripe: { domain: "stripe.com" },
  airbnb: { domain: "airbnb.com" },
  salesforce: { domain: "salesforce.com" },
  linkedin: { domain: "linkedin.com" },
  oracle: { domain: "oracle.com" },
  ibm: { domain: "ibm.com" },
  atlassian: { domain: "atlassian.com" },
  shopify: { domain: "shopify.com" },
  cloudflare: { domain: "cloudflare.com" },
  vercel: { domain: "vercel.com" },
};

/**
 * Dynamically resolves an interview cover/icon:
 * 1. Checks if a company is mentioned in the role (Google, Meta, Amazon, etc.) -> uses Google Favicon CDN or local cover PNG
 * 2. If no company, uses the primary tech stack from techstack -> uses official Devicon SVG
 * 3. Fallbacks cleanly to /tech.svg or /robot.png
 * 4. 100% deterministic: never changes on page refresh!
 */
export const getInterviewCoverImage = (
  role: string = "",
  techstack?: string[] | string,
  storedCover?: string
): string => {
  const normalizedRole = role.toLowerCase();

  // 1. Check for company mentions in the role
  const words = normalizedRole.split(/[\s,._/\\()-]+/);
  for (const word of words) {
    if (word && KNOWN_COMPANIES[word]) {
      const company = KNOWN_COMPANIES[word];
      if (company.localCover) return company.localCover;
      if (company.domain) {
        return `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128`;
      }
    }
  }

  // 2. Parse techstack
  let techList: string[] = [];
  if (Array.isArray(techstack)) {
    techList = techstack;
  } else if (typeof techstack === "string") {
    try {
      const parsed = JSON.parse(techstack);
      if (Array.isArray(parsed)) techList = parsed;
    } catch {
      techList = techstack.split(",").map((s) => s.trim());
    }
  }

  // Check tech stack for primary logo
  for (const tech of techList) {
    const normalized = normalizeTechName(tech);
    if (normalized) {
      return `${techIconBaseURL}/${normalized}/${normalized}-original.svg`;
    }
  }

  // Check if role itself mentions any known technology (e.g. "React Developer", "Python Engineer")
  for (const word of words) {
    const normalized = normalizeTechName(word);
    if (normalized) {
      return `${techIconBaseURL}/${normalized}/${normalized}-original.svg`;
    }
  }

  // 3. If stored cover exists and isn't random default
  if (storedCover && storedCover.trim()) {
    return storedCover;
  }

  // 4. Stable deterministic fallback based on role string hash (never random on re-render)
  let hash = 0;
  for (let i = 0; i < role.length; i++) {
    hash = (hash << 5) - hash + role.charCodeAt(i);
    hash |= 0;
  }
  const stableIndex = Math.abs(hash) % interviewCovers.length;
  return `/covers${interviewCovers[stableIndex]}`;
};
