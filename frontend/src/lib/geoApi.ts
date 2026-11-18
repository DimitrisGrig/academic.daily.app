import axiosInstance from "./axios";

/**
 * Fetch GSE dataset IDs for a given PubMed ID.
 * The backend proxies the GEO (POE) API so its credentials never reach the browser.
 * Returns an empty array on any failure so the caller is never impacted.
 */
export async function fetchGseIds(pmid: string): Promise<string[]> {
  try {
    const response = await axiosInstance.get("/geo/gse_ids", {
      params: { pmid },
      timeout: 20000,
    });

    const data = response.data;
    // The API returns a list of GSE ID strings
    if (Array.isArray(data)) {
      return data.filter((id: unknown) => typeof id === "string" && id.length > 0);
    }
    return [];
  } catch (error) {
    // Silently fail — this feature is supplementary and must not affect the modal
    console.warn("GEO API: Failed to fetch GSE IDs for PMID", pmid, error);
    return [];
  }
}
