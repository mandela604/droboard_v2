const B = 'https://droboard-v2.onrender.com';
async function post(path, body) {
  const r = await fetch(B + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const t = await r.text();
  return { status: r.status, text: t.slice(0, 300) };
}
(async () => {
  const stamp = Date.now().toString().slice(-7);
  console.log('probe register:', await post('/api/auth/register', {
    fullName: 'Probe Check', name: 'Probe Check', username: 'probe_chk_' + stamp,
    email: `probe.chk.${stamp}@droboard.test`, password: 'Dro!board2026#QA', country: 'NG',
  }));
  console.log('qa.admin duplicate:', await post('/api/auth/register', {
    fullName: 'QA Admin', name: 'QA Admin', username: 'qa_admin_chk_' + stamp,
    email: 'qa.admin@droboard.test', password: 'Dro!board2026#QA', country: 'NG',
  }));
  console.log('login probe:', await post('/api/auth/login', { email: `probe.chk.${stamp}@droboard.test`, password: 'Dro!board2026#QA' }));
})().catch(e => console.log('ERR', e && e.message));
