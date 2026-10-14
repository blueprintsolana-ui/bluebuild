/** Launch form defaults, kept free of app imports so they can be unit tested directly. */

export type LaunchForm = {
  name: string;
  symbol: string;
  description: string;
  twitter: string;
  telegram: string;
  initialBuySol: string;
};

/** A short ticker suggestion from the design title, e.g. "Smart Water Bottle" -> "SWB". */
export function suggestTicker(title: string): string {
  const words = title.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const meaningful = words.filter((word) => !/^(A|AN|THE|AND|WITH|FOR|OF|1L|\d+)$/.test(word));
  const source = meaningful.length ? meaningful : words;
  const initials = source.map((word) => word[0]).join("");
  const ticker = initials.length >= 3 ? initials : (source[0] || "COIN").slice(0, 6);
  return ticker.slice(0, 6) || "COIN";
}

/** The coin's website is always its Bluebuild pitch deck, so it isn't part of the form. */
export function defaultLaunchForm(title: string, description: string): LaunchForm {
  return {
    name: title.trim().slice(0, 32),
    symbol: suggestTicker(title),
    description: description.trim().slice(0, 500),
    twitter: "",
    telegram: "",
    initialBuySol: "0",
  };
}
