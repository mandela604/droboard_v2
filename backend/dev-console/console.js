'use strict';
// Staff surfaces: chief editor, senior editor and finance console endpoints.
// The engine (fetch, templating, logging) lives in engine.js and is shared with
// the reader/author console in users.js.

const R = (name, token, method, path, body, note) => ({ name, token, method, path, body, note });

const GROUPS = [
  { title: 'Reads — what each role is allowed to see', items: [
    R('chief: senior editor list', 'chief', 'GET', '/api/chief/senior-editors?limit=10'),
    R('chief: quotas', 'chief', 'GET', '/api/chief/senior-editors/quotas'),
    R('chief: assignment table (bare array)', 'chief', 'GET', '/api/chief/assignments'),
    R('chief: flagged books (view only)', 'chief', 'GET', '/api/chief/books/flagged?limit=5'),
    R('chief: story reports', 'chief', 'GET', '/api/chief/reports/story'),
    R('seA: contracts overview — own authors only', 'se', 'GET', '/api/senior-editor/contracts/overview'),
    R('seB: contracts overview — a DIFFERENT row set', 'se2', 'GET', '/api/senior-editor/contracts/overview'),
    R('finance: payouts queue with payee revealed', 'finance', 'GET', '/api/finance/withdrawals'),
  ] },
  { title: 'Writes — invites', items: [
    R('POST invite (expect 201 + one-time token)', 'chief', 'POST', '/api/chief/senior-editors/invites',
      { name: 'Nia Author', email: 'nia.{{runStamp}}@dev.local', target: 20, monthlyPay: 50000, deadline: '2026-12-01' }),
    R('same invite again (expect 409 invite_pending)', 'chief', 'POST', '/api/chief/senior-editors/invites',
      { name: 'Nia Author', email: 'nia.{{runStamp}}@dev.local' }),
    R('bad email (expect 400 with zod field error)', 'chief', 'POST', '/api/chief/senior-editors/invites',
      { name: 'X', email: 'not-an-email' }),
    R('PATCH editor quota/deadline (expect 200)', 'chief', 'PATCH', '/api/chief/senior-editors/{{seId}}',
      { target: 40, deadline: '2026-11-30', note: 'q4 push' }),
  ] },
  { title: 'Writes — assignments (no 100-author cap)', items: [
    R('PUT replace-all with both writers', 'chief', 'PUT', '/api/chief/senior-editors/{{seId2}}/assignments',
      { authorIds: ['{{authorId}}', '{{authorId2}}'] }),
    R('POST delta: add ONE writer by id', 'chief', 'POST', '/api/chief/senior-editors/{{seId2}}/assignments/authors',
      { authorId: '{{authorId}}' }),
    R('POST same id again (idempotent)', 'chief', 'POST', '/api/chief/senior-editors/{{seId2}}/assignments/authors',
      { authorId: '{{authorId}}' }),
    R('POST non-existent author (expect 400 bad_author)', 'chief', 'POST', '/api/chief/senior-editors/{{seId2}}/assignments/authors',
      { authorId: 'nope-123' }),
    R('DELETE that writer back off', 'chief', 'DELETE', '/api/chief/senior-editors/{{seId2}}/assignments/authors/{{authorId}}'),
  ] },
  { title: 'Flag rules — the chief only views', items: [
    R('CHIEF flags on a chief route (expect 404: no such route)', 'chief', 'POST', '/api/chief/books/{{bookId}}/flag',
      { reason: 'spam', note: 'mass-posted', password: '{{password}}' }),
    R('CHIEF on the senior flag route (expect 403 chief_does_not_flag)', 'chief', 'POST', '/api/senior-editor/books/{{bookId}}/flag',
      { reason: 'spam', password: '{{password}}' }),
    R('SE flags a FOREIGN author book (expect 404)', 'se', 'POST', '/api/senior-editor/books/{{bookId2}}/flag',
      { reason: 'plagiarism', password: '{{password}}' }),
    R('SE flags with WRONG password (expect 401)', 'se', 'POST', '/api/senior-editor/books/{{bookId}}/flag',
      { reason: 'plagiarism', password: 'guess' }),
    R('OWNING SE flags own book (expect 200 + reportId)', 'se', 'POST', '/api/senior-editor/books/{{bookId}}/flag',
      { reason: 'plagiarism', note: 'copied chapters', password: '{{password}}' }),
    R('flags the SAME book again (expect 409 already_flagged)', 'se', 'POST', '/api/senior-editor/books/{{bookId}}/flag',
      { reason: 'plagiarism', password: '{{password}}' }),
    R('OWNING SE unflags (expect 200 published)', 'se', 'POST', '/api/senior-editor/books/{{bookId}}/unflag',
      { password: '{{password}}' }),
  ] },
  { title: 'Money — the fail-closed gate', items: [
    R('approve EDITOR payout (expect 200, row settles + journals)', 'finance', 'POST', '/api/finance/withdrawals/{{epayoutId}}/approve', {}),
    R('approve AUTHOR withdrawal on an empty journal (expect 409 insufficient_funds)', 'finance', 'POST', '/api/finance/withdrawals/{{withdrawalId}}/approve', {}),
  ] },
  { title: 'Earnings + policies', items: [
    R('PUT chief earnings settings', 'chief', 'PUT', '/api/chief/earnings/settings',
      { enabled: true, mode: 'hybrid', revenueSharePct: 10, fixedMonthlyAmount: 250000, currency: 'NGN', payoutDay: 28 }),
    R('GET chief earnings settings (round-trip)', 'chief', 'GET', '/api/chief/earnings/settings'),
    R('POST policy v1', 'chief', 'POST', '/api/chief/policies', { title: 'No AI-generated art', body: 'Draft text', status: 'draft' }),
    R('PATCH policy (version bumps to 2)', 'chief', 'PATCH', '/api/chief/policies/{{policyId}}', { title: 'No AI-generated art (v2)' }),
    R('POST archive policy', 'chief', 'POST', '/api/chief/policies/{{policyId}}/archive', {}),
  ] },
  { title: 'Authorisation denials', items: [
    R('reader hits the chief console (expect 403)', 'reader', 'GET', '/api/chief/senior-editors?limit=5'),
    R('no token at all (expect 401)', '', 'GET', '/api/chief/senior-editors?limit=5'),
    R('SE creates a platform announcement (expect 403)', 'se', 'POST', '/api/senior-editor/announcements',
      { title: 'Platform shift', content: 'everyone', audience: 'all', status: 'published' }),
    R('chief creates it instead (expect 200/201)', 'chief', 'POST', '/api/senior-editor/announcements',
      { title: 'Platform shift', content: 'everyone', audience: 'all', status: 'published' }),
    R('SE edits the chief announcement (expect 403)', 'se', 'PUT', '/api/senior-editor/announcements/{{annId}}', { title: 'Hijacked' }),
  ] },
];

mountConsole(GROUPS);
