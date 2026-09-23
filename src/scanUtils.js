// Read card links without navigating to or requesting the scanned URL.
export function cardToken(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const match = url.pathname.match(/^\/student\/([^/]+)\/?$/);
    if (!match) return null;
    const token = decodeURIComponent(match[1]);
    return /^[a-zA-Z0-9_-]{8,256}$/.test(token) ? token : null;
  } catch { return null; }
}

export function scanStatus(profile, today = new Date()) {
  if (!profile?.student || !Array.isArray(profile.monthly_dues) || typeof profile.transport_allowed !== 'boolean') {
    throw new Error('Përgjigjja e serverit nuk është e vlefshme. Provoni përsëri.');
  }
  const month = today.getFullYear() * 12 + today.getMonth() + 1;
  const current = profile.monthly_dues.find((due) => Number(due.calendar_year) * 12 + Number(due.month) === month);
  const unpaid = profile.monthly_dues.filter((due) =>
    Number(due.calendar_year) * 12 + Number(due.month) <= month && ['PENDING', 'OVERDUE', 'BLOCKED'].includes(due.status));
  if (!profile.transport_allowed) return { kind: 'bad', title: 'Nuk lejohet udhëtimi', current, unpaid };
  if (unpaid.length) return { kind: 'bad', title: 'Pagesë e papaguar', current, unpaid };
  if (current?.status === 'PAID') return { kind: 'good', title: 'Paguar', current, unpaid };
  return { kind: 'unknown', title: 'Pagesa e muajit nuk është konfirmuar', current, unpaid };
}

// A different card is accepted immediately; the same card must leave the frame.
export function createScanGate(gapMs = 2000) {
  let previous = null;
  let lastSeen = 0;
  return (value, now = Date.now()) => {
    const accept = value !== previous || now - lastSeen > gapMs;
    previous = value;
    lastSeen = now;
    return accept;
  };
}
