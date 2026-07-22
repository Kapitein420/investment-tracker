"use client";

/**
 * Opens a blank tab synchronously — inside the click handler, before any
 * await — so the browser still attributes it to the user gesture, then
 * navigates it to the URL once the async fetch resolves. Calling
 * window.open(url) *after* an await is silently blocked by pop-up
 * blockers in most browsers: no exception, no console error, the tab
 * just never appears. Worse, on documents whose signed PDF needs lazy
 * regeneration (see BUG-015) the extra delay makes the block more likely.
 * This is the fix for that class of bug (BUG-042).
 */
export async function openInNewTab(fetchUrl: () => Promise<string>): Promise<void> {
  const w = window.open("", "_blank");
  try {
    const url = await fetchUrl();
    if (!w) {
      throw new Error("Pop-up blocked — allow pop-ups for this site and try again.");
    }
    w.location.href = url;
  } catch (e) {
    w?.close();
    throw e;
  }
}
