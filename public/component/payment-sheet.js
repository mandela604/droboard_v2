/**
 * component/payment-sheet.js — bottom payment sheet (live checkout).
 * DroboardPaySheet.open({ title, sub, price, packCode, amountNGN, onSuccess(receipt), onError(err) })
 * Self-contained CSS. Page stays call-and-render (no page edits needed
 * beyond loading this file).
 */
(function () {
  'use strict';
  if (window.DroboardPaySheet) return;

  const CSS = `
    .dps-ov{position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;transition:.22s}
    .dps-ov.open{opacity:1;pointer-events:auto}
    .dps-sheet{width:100%;max-width:420px;background:var(--l1,#fff);border-radius:20px 20px 0 0;padding:14px 18px calc(20px + env(safe-area-inset-bottom,0px));transform:translateY(30px);transition:.25s}
    .dps-ov.open .dps-sheet{transform:translateY(0)}
    .dps-handle{width:40px;height:4px;border-radius:4px;background:rgba(128,128,128,.35);margin:0 auto 12px}
    .dps-title{font-size:15px;font-weight:800;color:var(--tx-high,#161616)}
    .dps-sub{font-size:11.5px;color:var(--tx-muted,#666);margin-top:2px}
    .dps-item{display:flex;align-items:center;gap:12px;background:var(--l2,#f4f4f6);border-radius:12px;padding:12px;margin:12px 0}
    .dps-coins{font-size:22px;font-weight:800;color:var(--tx-high,#161616)}
    .dps-coins small{font-size:11px;color:var(--tx-muted,#666);font-weight:600}
    .dps-price{margin-left:auto;font-size:15px;font-weight:800;color:var(--acc,#ff0050)}
    .dps-m{display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;border-radius:12px;border:1.5px solid var(--bd,rgba(0,0,0,.1));background:transparent;color:var(--tx-high,#161616);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;font-family:inherit;text-align:left}
    .dps-m.on{border-color:var(--acc,#ff0050);background:rgba(255,0,80,.05)}
    .dps-m i{font-size:16px;width:22px;text-align:center}
    .dps-m small{display:block;font-size:10px;color:var(--tx-muted,#666);font-weight:600}
    .dps-pay{width:100%;padding:13px;border:none;border-radius:12px;background:var(--acc,#ff0050);color:#fff;font-size:14px;font-weight:800;cursor:pointer;margin-top:4px;font-family:inherit}
    .dps-pay:disabled{opacity:.6}
    .dps-cancel{width:100%;padding:12px;border-radius:12px;border:1px solid var(--bd,rgba(0,0,0,.1));background:transparent;color:var(--tx-muted,#666);font-size:13px;font-weight:700;cursor:pointer;margin-top:8px;font-family:inherit}
    .dps-note{font-size:10px;color:var(--tx-faint,#999);text-align:center;margin-top:10px}
    .dps-spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:dpsSpin .7s linear infinite;vertical-align:-3px;margin-right:6px}
    @keyframes dpsSpin{to{transform:rotate(360deg)}}
  `;
  let styleDone = false;
  function ensureStyle() {
    if (styleDone) return; styleDone = true;
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
  }

  function open(opts) {
    opts = opts || {};
    ensureStyle();
    close();
    const methods = (window.PaymentService ? PaymentService.methods() : [{ id: 'paystack', name: 'Paystack', icon: 'fas fa-credit-card', hint: '' }]);
    let method = methods[0].id;
    const ov = document.createElement('div');
    ov.className = 'dps-ov'; ov.id = 'dpsOv';
    ov.innerHTML = '<div class="dps-sheet">'
      + '<div class="dps-handle"></div>'
      + '<div class="dps-title">' + esc(opts.title || 'Checkout') + '</div>'
      + '<div class="dps-sub">' + esc(opts.sub || '') + '</div>'
      + '<div class="dps-item"><div class="dps-coins">' + esc(String(opts.coins || '')) + ' <small>coins</small></div>'
      + '<div class="dps-price">' + esc(opts.price || '') + '</div></div>'
      + '<div id="dpsMethods">' + methods.map(function (m, i) {
        return '<button class="dps-m' + (i === 0 ? ' on' : '') + '" data-m="' + m.id + '">'
          + '<i class="' + m.icon + '"></i><span style="flex:1">' + m.name + '<small>' + (m.hint || '') + '</small></span>'
          + '</button>';
      }).join('') + '</div>'
      + '<button class="dps-pay" id="dpsPay">Pay ' + esc(opts.price || '') + '</button>'
      + '<button class="dps-cancel" id="dpsCancel">Cancel</button>'
      + '<div class="dps-note">Secured checkout · coins credit after verification.</div>'
      + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });

    function done() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.addEventListener('click', function (e) { if (e.target === ov) { if (cancelHook) cancelHook(); done(); } });
    ov.querySelector('#dpsCancel').addEventListener('click', function () { if (cancelHook) cancelHook(); done(); });
    ov.querySelectorAll('[data-m]').forEach(function (b) {
      b.addEventListener('click', function () {
        method = b.dataset.m;
        ov.querySelectorAll('[data-m]').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
    let cancelHook = null;
    ov.querySelector('#dpsPay').addEventListener('click', function () {
      const btn = ov.querySelector('#dpsPay');
      btn.disabled = true;
      btn.innerHTML = '<span class="dps-spin"></span>Processing…';
      const p = { title: opts.title, price: opts.price, coins: opts.coins, method: method,
        packCode: opts.packCode, amountNGN: opts.amountNGN, email: opts.email };
      window.PaymentService.checkout(p).then(function (receipt) {
        done();
        if (opts.onSuccess) opts.onSuccess(receipt);
      }).catch(function (err) {
        done();
        if (err && err.cancelled) return;
        if (opts.onError) opts.onError(err);
      });
    });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function close() { const o = document.getElementById('dpsOv'); if (o && o.parentNode) o.parentNode.removeChild(o); }

  window.DroboardPaySheet = { open: open, close: close };
})();
