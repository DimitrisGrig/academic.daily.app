/**
 * Extracts the countries of the first and last authors from
 * `authors_full` and `affiliations` strings.
 *
 * Data format (PubMed-style):
 *   authors_full : "FirstName LastName:1,2; SecondAuthor:3; LastAuthor:1"
 *   affiliations : "1 Dept of X, University of Y, City, Country; 2 School of Z, City, Country"
 *
 * Returns a deduplicated array of country strings (1 element if both
 * authors share the same country, 2 otherwise). Returns [] when
 * extraction is not possible.
 */

// Common country name normalisations / cleaning
const COUNTRY_ALIASES: Record<string, string> = {
  usa: "USA",
  "u.s.a.": "USA",
  "united states": "USA",
  "united states of america": "USA",
  uk: "UK",
  "u.k.": "UK",
  "united kingdom": "UK",
  "england": "UK",
  "scotland": "UK",
  "wales": "UK",
  "northern ireland": "UK",
  "republic of korea": "South Korea",
  "korea": "South Korea",
  "people's republic of china": "China",
  "p.r. china": "China",
  "p. r. china": "China",
  "pr china": "China",
  "russian federation": "Russia",
  "czech republic": "Czechia",
  "republic of ireland": "Ireland",
  "the netherlands": "Netherlands",
  "kingdom of saudi arabia": "Saudi Arabia"
};

/**
 * Normalise a raw country token extracted from an affiliation string.
 * Strips trailing periods, postal/zip codes, email addresses, and
 * common noise such as "Electronic address: …".
 */
function cleanCountry(raw: string): string | null {
  let c = raw.trim();

  // Remove ALL trailing periods / dots (handles "china.", "china..", etc.)
  c = c.replace(/\.+\s*$/, "").trim();

  // Also strip leading/trailing periods that may remain
  c = c.replace(/^\.+|\.+$/g, "").trim();

  // Remove anything that looks like an email / electronic address note
  c = c.replace(/electronic\s+address.*$/i, "").trim();
  c = c.replace(/\S+@\S+/g, "").trim();

  // Remove trailing postal / zip codes (e.g. "Germany 10115" or "12345 USA")
  c = c.replace(/\b\d{4,6}\b/g, "").trim();

  // Strip wrapping parentheses
  c = c.replace(/^\(|\)$/g, "").trim();

  // Final period cleanup after all other stripping
  c = c.replace(/\.+\s*$/, "").trim();

  if (c.length === 0 || c.length > 40) return null;

  const key = c.toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];

  // Capitalise first letter of each word for consistent display
  return c.replace(/\b\w/g, l => l.toUpperCase());
}

interface ParsedAuthor {
  name: string;
  affiliationNums: string[]; // e.g. ["1", "2"]
}

function parseAuthors(authorsRaw: string[] | string): ParsedAuthor[] {
  if (!authorsRaw) return [];

  const entries: string[] =
    typeof authorsRaw === "string"
      ? authorsRaw
          .split(";")
          .map(a => a.trim())
          .filter(a => a.length > 0)
      : authorsRaw;

  return entries.map(entry => {
    const match = entry.match(/^(.+?):(\d+(?:,\d+)*)$/);
    if (match) {
      return {
        name: match[1].trim(),
        affiliationNums: match[2].split(",").map(n => n.trim()),
      };
    }
    return { name: entry.split(":")[0].trim(), affiliationNums: [] };
  });
}

/**
 * Build a map of affiliation number → full text.
 * Input: "1 Dept of X, City, Country; 2 School of Y, City, Country"
 * Output: { "1": "Dept of X, City, Country", "2": "School of Y, City, Country" }
 */
function parseAffiliations(raw: string | null): Record<string, string> {
  if (!raw) return {};
  const map: Record<string, string> = {};
  raw
    .split(";")
    .map(a => a.trim())
    .filter(a => /^\d+\s*/.test(a))
    .forEach(a => {
      const match = a.match(/^(\d+)\s+(.+)$/);
      if (match) {
        map[match[1]] = match[2].trim();
      }
    });
  return map;
}

/**
 * Given an affiliation text, extract the country (last comma-separated token).
 */
function countryFromAffiliation(text: string): string | null {
  // Split by comma, take the last non-empty segment
  const parts = text.split(",").map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length === 0) return null;
  // The last segment is usually the country
  return cleanCountry(parts[parts.length - 1]);
}

/**
 * Extract the country for a given author using their affiliation numbers.
 * Uses the first affiliated institution's country.
 */
function getAuthorCountry(
  author: ParsedAuthor,
  affMap: Record<string, string>
): string | null {
  for (const num of author.affiliationNums) {
    const text = affMap[num];
    if (text) {
      const country = countryFromAffiliation(text);
      if (country) return country;
    }
  }
  return null;
}

/**
 * Main export: given article's authors_full and affiliations, return
 * the deduplicated country tag(s) for the first and last authors.
 *
 * @returns string[] with 0, 1, or 2 country names
 */
export function getAuthorCountries(
  authorsFullRaw: string[] | string | null | undefined,
  affiliationsRaw: string | null | undefined
): string[] {
  if (!authorsFullRaw || !affiliationsRaw) return [];

  const authors = parseAuthors(authorsFullRaw);
  if (authors.length === 0) return [];

  const affMap = parseAffiliations(affiliationsRaw);
  if (Object.keys(affMap).length === 0) return [];

  const firstAuthor = authors[0];
  const lastAuthor = authors.length > 1 ? authors[authors.length - 1] : null;

  const firstCountry = getAuthorCountry(firstAuthor, affMap);

  if (!lastAuthor) {
    return firstCountry ? [firstCountry] : [];
  }

  const lastCountry = getAuthorCountry(lastAuthor, affMap);

  // Deduplicate (case-insensitive to handle "China" vs "china" edge cases)
  const countries: string[] = [];
  if (firstCountry) countries.push(firstCountry);
  if (lastCountry && lastCountry.toLowerCase() !== firstCountry?.toLowerCase()) countries.push(lastCountry);

  return countries;
}

/**
 * Return the country of the last author only, or null if unavailable.
 */
export function getLastAuthorCountry(
  authorsFullRaw: string[] | string | null | undefined,
  affiliationsRaw: string | null | undefined
): string | null {
  if (!authorsFullRaw || !affiliationsRaw) return null;

  const authors = parseAuthors(authorsFullRaw);
  if (authors.length === 0) return null;

  const affMap = parseAffiliations(affiliationsRaw);
  if (Object.keys(affMap).length === 0) return null;

  const lastAuthor = authors[authors.length - 1];
  return getAuthorCountry(lastAuthor, affMap);
}
