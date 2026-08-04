import api, { getAuthToken, getCompanyId } from './api';

/** Download a binary PDF from an authenticated API route. */
export async function downloadPdf(path, filename) {
  const res = await api.get(path, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'document.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Open PDF in a new tab (useful for preview). */
export async function openPdf(path) {
  const res = await api.get(path, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  // Revoke later so the tab can still load.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export { getAuthToken, getCompanyId };
