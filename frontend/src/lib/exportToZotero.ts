/**
 * Zotero integration helpers.
 *
 * Uses the backend OAuth proxy to connect the user's Zotero account
 * and export articles directly into their Zotero web library.
 */

import axiosInstance from "./axios";

export interface ZoteroArticlePayload {
  article_id: number;
  title: string;
  abstract?: string | null;
  journal?: string | null;
  publication_date?: string | null;
  authors_full?: string[] | string | null;
  doi?: string | null;
  pmid?: string | null;
  pmcid?: string | null;
  issn?: string | null;
  mesh_terms?: string | null;
  url?: string | null;
}

/** Check whether the current user has a connected Zotero account. */
export async function getZoteroStatus(): Promise<boolean> {
  const res = await axiosInstance.get("/zotero/status");
  return res.data.connected === true;
}

/** Start the OAuth flow — returns the Zotero authorize URL. */
export async function initZoteroAuth(): Promise<string> {
  const res = await axiosInstance.get("/zotero/auth/init");
  return res.data.authorize_url;
}

/**
 * Complete the OAuth flow after the user returns from Zotero.
 * Called from the ZoteroCallback page.
 */
export async function completeZoteroAuth(
  oauthToken: string,
  oauthVerifier: string,
): Promise<void> {
  await axiosInstance.post(
    `/zotero/auth/callback?oauth_token=${encodeURIComponent(oauthToken)}&oauth_verifier=${encodeURIComponent(oauthVerifier)}`,
  );
}

/** Export an article to the user's connected Zotero library. */
export async function exportToZotero(payload: ZoteroArticlePayload, force = false): Promise<string> {
  const res = await axiosInstance.post(`/zotero/export${force ? "?force=true" : ""}`, payload);
  return res.data.message;
}

/** Check which article IDs have already been exported to Zotero. */
export async function getZoteroExportedArticles(articleIds: number[]): Promise<number[]> {
  if (articleIds.length === 0) return [];
  const res = await axiosInstance.post("/zotero/exported-articles", { article_ids: articleIds });
  return res.data.exported_ids;
}

/** Disconnect the user's Zotero account. */
export async function disconnectZotero(): Promise<void> {
  await axiosInstance.delete("/zotero/disconnect");
}

