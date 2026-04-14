/**
 * Safely format FastAPI error detail for display in toast/UI
 * FastAPI 422 errors return: [{type, loc, msg, input, url}]
 * FastAPI 4xx errors return: string detail
 */
export function formatApiError(detail, fallback = 'Erro ao processar requisição') {
  if (detail == null) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        if (e && typeof e.msg === 'string') return e.msg;
        if (typeof e === 'string') return e;
        return JSON.stringify(e);
      })
      .filter(Boolean)
      .join('; ') || fallback;
  }
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
}

/**
 * Clean form data before sending to API
 * Converts empty strings to null for optional fields
 */
export function cleanFormData(data) {
  const cleaned = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === '' || value === undefined) {
      cleaned[key] = null;
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
