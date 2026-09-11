(function () {
  'use strict';

  if (window.__droboardReader) return;
  window.__droboardReader = true;

  const CSS = `
    .drd-ov{position:fixed;inset:0;z-index:1700;background:#000;display:none;flex-direction:column;overflow:hidden;font-family:'DM Sans',system-ui,sans-serif;color:var(--tx,#f0f0f0)}
    .drd-ov.open{display:flex}
    .drd-prog{position:absolute;top:0;left:0;right:0;height:2px;z-index:60;background:rgba(255,255,255,.08)}
    .drd-prog-fill{height:100%;background:linear-gradient(90deg,var(--acc,#ff0050),var(--acc2,#ff4d7a));transition:width .3s;width:0%}
    .drd-hdr{position:absolute;top:0;left:0;right:0;z-index:50;padding:12px 12px 0;display:flex;justify-content:space-between;align-items:flex-start;pointer-events:none}
    .drd-hdr>*{pointer-events:auto}
    .drd-hdr-right{display:flex;align-items:center;gap:8px}
    .drd-close{width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.7);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;border:1px solid rgba(255,255,255,.08);color:#fff}
    .drd-meta{background:rgba(0,0,0,.7);backdrop-filter:blur(10px);border-radius:24px;padding:4px 11px;font-size:10px;font-weight:600;display:flex;gap:10px;border:1px solid rgba(255,255,255,.08);color:#aaa}
    .drd-title-blk{position:absolute;top:54px;left:12px;right:12px;z-index:50;pointer-events:auto;transition:opacity .3s}
    .drd-story-t{font-family:'Playfair Display',serif;font-size:13px;font-weight:900;line-height:1.2;margin-bottom:2px;color:#fff}
    .drd-ch{font-size:10px;color:var(--acc2,#ff4d7a);font-weight:600}
    .drd-meta-row{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;margin-top:2px}
    .drd-syn-btn{display:inline-flex;align-items:center;gap:4px;background:rgba(255,0,80,.15);border:1px solid rgba(255,0,80,.3);color:var(--acc2,#ff4d7a);font-size:9px;font-weight:700;padding:3px 9px;border-radius:16px;cursor:pointer;margin-top:4px}
    .drd-full-btn{background:var(--acc,#ff0050);border:none;color:#fff;padding:4px 11px;border-radius:16px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit}
    .drd-slides{flex:1;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;overscroll-behavior-x:contain}
    .drd-slides::-webkit-scrollbar{display:none}
    .drd-slide{flex:0 0 100%;width:100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always;position:relative;display:flex;flex-direction:column;background:#050508;overflow:hidden}
    .drd-cover-sl{justify-content:center;align-items:center;text-align:center;background:#000}
    .drd-cover-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.12;z-index:0}
    .drd-overlay-grad{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.99) 0%,rgba(0,0,0,.65) 50%,rgba(0,0,0,.45) 100%);z-index:1}
    .drd-cover-cnt{position:relative;z-index:5;padding:64px 22px 100px;display:flex;flex-direction:column;align-items:center;gap:8px;overflow-y:auto;scrollbar-width:none;width:100%}
    .drd-cover-cnt::-webkit-scrollbar{display:none}
    .drd-cov-cat{background:var(--acc,#ff0050);padding:3px 11px;border-radius:14px;font-size:9px;font-weight:800}
    .drd-cov-title{font-family:'Playfair Display',serif;font-size:20px;font-weight:900;line-height:1.2;text-shadow:0 2px 12px rgba(0,0,0,.9)}
    .drd-cov-ch{background:rgba(255,255,255,.07);padding:3px 11px;border-radius:14px;font-size:9px;font-weight:600;color:var(--acc2,#ff4d7a)}
    .drd-cov-syn-wrap{width:100%;max-width:280px}
    .drd-cov-syn{font-size:12px;color:#aaa;line-height:1.55;font-style:italic;padding:11px 13px;background:rgba(255,255,255,.04);border-radius:9px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .drd-cov-syn.expanded{display:block;-webkit-line-clamp:unset}
    .drd-cov-see-more{font-size:11px;color:var(--acc2,#ff4d7a);font-weight:700;cursor:pointer;margin-top:5px;text-align:center;display:block}
    .drd-cov-actions{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;max-width:260px;margin-top:4px}
    .drd-cov-start{width:100%;background:var(--acc,#ff0050);color:#fff;font-weight:800;font-size:13px;padding:11px 26px;border-radius:24px;cursor:pointer;border:none;box-shadow:0 0 18px var(--glow,rgba(255,0,80,.3));font-family:inherit}
    .drd-cov-full{width:100%;background:rgba(255,255,255,.07);color:#ccc;font-weight:700;font-size:12px;padding:9px;border-radius:24px;cursor:pointer;border:1px solid rgba(255,255,255,.1);font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px}
    .drd-cov-pills{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;width:100%;max-width:280px;margin-top:2px}
    .drd-cov-pill{display:flex;align-items:center;gap:5px;padding:7px 13px;border-radius:20px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#aaa;transition:.18s;font-family:inherit}
    .drd-cov-pill.off{opacity:.3;cursor:not-allowed}
    .drd-scene-box{position:relative;z-index:5;padding:96px 0 118px;height:100%;overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column;justify-content:center}
    .drd-scene-box::-webkit-scrollbar{display:none}
    .drd-scene-txt{font-family:'Playfair Display',serif;font-size:13px;font-weight:500;line-height:1.95;color:#e8e8f0;user-select:text;-webkit-user-select:text;cursor:text;white-space:pre-wrap;padding:0 18px}
    .drd-scene-num{font-size:9px;color:var(--acc,#ff0050);font-weight:700;margin-top:18px;opacity:.7;text-align:right;padding-right:18px}
    .drd-ad-slide{flex:0 0 100%;width:100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#080810;text-align:center;padding:32px 22px}
    .drd-ad-inn{max-width:300px;width:100%}
    .drd-ad-sp{font-size:11px;color:#fff;font-weight:800;background:var(--acc,#ff0050);padding:4px 14px;border-radius:16px;display:inline-block;margin-bottom:12px}
    .drd-ad-logo{width:46px;height:46px;border-radius:12px;object-fit:cover;margin:0 auto 9px}
    .drd-ad-brand{font-size:12px;font-weight:800;color:var(--acc,#ff0050);margin-bottom:5px}
    .drd-ad-h{font-family:'Playfair Display',serif;font-size:18px;font-weight:900;line-height:1.3;margin-bottom:7px}
    .drd-ad-b{font-size:12px;color:#888;line-height:1.45;margin-bottom:14px}
    .drd-ad-cta{background:var(--acc,#ff0050);color:#fff;font-weight:800;font-size:12px;padding:10px 24px;border-radius:24px;border:none;cursor:pointer;box-shadow:0 4px 18px var(--glow,rgba(255,0,80,.3));width:100%}
    .drd-ad-skip{font-size:11px;color:#444;margin-top:9px;cursor:pointer}
    .drd-bottom{position:absolute;left:0;right:0;bottom:0;z-index:60;display:flex;flex-direction:column;background:linear-gradient(0deg,rgba(0,0,0,.99) 55%,transparent 100%);opacity:0;pointer-events:none;transition:opacity .35s}
    .drd-bottom.show{opacity:1;pointer-events:auto}
    .drd-icons{display:flex;justify-content:space-around;padding:10px 0 calc(env(safe-area-inset-bottom,0px) + 12px)}
    .drd-act{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;user-select:none;padding:2px 8px}
    .drd-act span{font-size:9px;font-weight:600;color:#888;text-align:center}
    .drd-act-ico{width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.75);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:20px;transition:.18s;color:#888}
    .drd-act:active .drd-act-ico{transform:scale(.88)}
    .drd-act.liked .drd-act-ico{background:rgba(255,0,80,.14);border-color:rgba(255,0,80,.3)}
    .drd-act.saved .drd-act-ico{background:rgba(100,200,255,.12);border-color:rgba(100,200,255,.25);color:#7dd3fc}
    .drd-act.tip .drd-act-ico{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.2);color:#fbbf24}
    .drd-end-box{position:relative;z-index:5;text-align:center;padding:50px 22px;display:flex;flex-direction:column;align-items:center;gap:10px;height:100%;justify-content:center}
    .drd-end-btn{padding:8px 16px;border-radius:24px;font-weight:700;font-size:11px;cursor:pointer;border:none;font-family:inherit}
    .drd-end-btn.pri{background:var(--acc,#ff0050);color:#fff;box-shadow:0 0 16px var(--glow,rgba(255,0,80,.3))}
    .drd-end-btn.sec{background:rgba(255,255,255,.08);color:#ccc;border:1px solid rgba(255,255,255,.08)}
    .drd-eng-sl{flex:0 0 100%;width:100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always;background:linear-gradient(180deg,#000 0%,#060010 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;padding:60px 16px 90px}
    .drd-eng-sl::-webkit-scrollbar{display:none}
    .drd-eng-inner{width:100%;max-width:360px;display:flex;flex-direction:column;gap:12px}
    .drd-eng-tag{display:inline-flex;align-items:center;gap:5px;background:rgba(255,0,80,.08);border:1px solid rgba(255,0,80,.2);color:var(--acc2,#ff4d7a);font-size:9px;font-weight:800;padding:4px 12px;border-radius:14px;letter-spacing:.08em;align-self:flex-start}
    .drd-eng-title{font-family:'Playfair Display',serif;font-size:17px;font-weight:900;color:#fff;line-height:1.3;text-align:left}
    .drd-eng-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;width:100%}
    .drd-eng-opts{padding:12px 14px;display:flex;flex-direction:column;gap:8px}
    .drd-eng-opt{position:relative;border-radius:10px;padding:12px 13px;cursor:pointer;overflow:hidden;border:1px solid rgba(255,255,255,.07);transition:border-color .2s;user-select:none}
    .drd-eng-opt.voted{border-color:var(--acc,#ff0050)}
    .drd-eng-opt-bar{position:absolute;left:0;top:0;bottom:0;background:rgba(255,0,80,.1);transition:width .6s cubic-bezier(.4,0,.2,1);z-index:0}
    .drd-eng-opt-row{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .drd-eng-opt-txt{font-size:13px;font-weight:600;color:#e0e0e0;flex:1}
    .drd-eng-opt-pct{font-size:12px;font-weight:800;color:var(--acc,#ff0050);min-width:36px;text-align:right}
    .drd-eng-foot{padding:8px 14px 12px;display:flex;align-items:center;justify-content:space-between}
    .drd-eng-total{font-size:10px;color:#444}
    .drd-eng-share{font-size:10px;font-weight:700;color:var(--acc2,#ff4d7a);cursor:pointer;display:flex;align-items:center;gap:4px}
    .drd-deb-sides{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 14px}
    .drd-d-side{border-radius:12px;padding:13px;cursor:pointer;border:1px solid rgba(255,255,255,.07);transition:all .2s;text-align:center;user-select:none}
    .drd-d-side.for.chosen{border-color:#10b981;background:rgba(16,185,129,.08)}
    .drd-d-side.against.chosen{border-color:#ff4444;background:rgba(255,68,68,.08)}
    .drd-d-side-em{font-size:22px;margin-bottom:4px}
    .drd-d-side-lbl{font-size:11px;font-weight:800;margin-bottom:6px}
    .drd-d-side.for .drd-d-side-lbl{color:#10b981}
    .drd-d-side.against .drd-d-side-lbl{color:#ff4444}
    .drd-d-bar-wrap{height:4px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden;margin-bottom:4px}
    .drd-d-bar{height:100%;border-radius:4px;transition:width .6s ease}
    .drd-d-side.for .drd-d-bar{background:#10b981}
    .drd-d-side.against .drd-d-bar{background:#ff4444}
    .drd-d-pct{font-size:11px;font-weight:800;color:#888}
    .drd-d-cnt{font-size:9px;color:#444;margin-top:2px}
    .drd-d-total-row{padding:0 14px 8px;font-size:10px;color:#444;display:flex;align-items:center;gap:5px}
    .drd-d-acts-row{padding:0 14px 10px;display:flex;gap:8px}
    .drd-d-act-btn{flex:1;padding:8px;border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px}
    .drd-d-act-btn.share{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#888}
    .drd-d-act-btn.open{background:rgba(255,0,80,.1);border:1px solid rgba(255,0,80,.25);color:var(--acc2,#ff4d7a)}
    .drd-d-cm-sec{padding:0 14px 10px}
    .drd-d-cm-lbl{font-size:9px;font-weight:800;color:#444;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
    .drd-dcm-row{display:flex;gap:8px;padding:8px 0}
    .drd-dcm-av{width:24px;height:24px;border-radius:50%;background:rgba(255,0,80,.2);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;flex-shrink:0}
    .drd-dcm-body{flex:1;min-width:0}
    .drd-dcm-nm{font-size:11px;font-weight:700;color:#e0e0e0;display:flex;align-items:center;gap:5px}
    .drd-dcm-side{font-size:8px;font-weight:800;padding:1px 6px;border-radius:7px}
    .drd-dcm-side.for{background:rgba(16,185,129,.12);color:#10b981}
    .drd-dcm-side.against{background:rgba(255,68,68,.12);color:#ff4444}
    .drd-dcm-txt{font-size:12px;color:#888;line-height:1.4;margin-top:2px;word-break:break-word}
    .drd-dcm-meta{margin-top:4px;display:flex;align-items:center;gap:8px}
    .drd-dcm-time{font-size:9px;color:#444}
    .drd-dcm-like{display:flex;align-items:center;gap:2px;font-size:10px;color:#444;cursor:pointer;user-select:none;padding:2px 4px;border-radius:6px}
    .drd-dcm-like.liked{color:var(--acc,#ff0050)}
    .drd-d-inp-row{display:flex;gap:8px;align-items:center;padding:0 14px 14px}
    .drd-d-inp{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:8px 13px;color:#e0e0e0;font-family:inherit;font-size:12px;outline:none}
    .drd-d-post-btn{background:var(--acc,#ff0050);border:none;color:#fff;padding:7px 14px;border-radius:18px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit}
    .drd-next-sl{flex:0 0 100%;width:100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always;background:linear-gradient(180deg,#000 0%,#080014 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px 90px;text-align:center;gap:16px}
    .drd-next-glow{width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(255,0,80,.3),transparent 70%);display:flex;align-items:center;justify-content:center;font-size:36px}
    .drd-next-badge{font-size:9px;font-weight:800;color:var(--acc,#ff0050);letter-spacing:.1em;text-transform:uppercase;background:rgba(255,0,80,.08);border:1px solid rgba(255,0,80,.2);padding:4px 14px;border-radius:14px}
    .drd-next-title{font-family:'Playfair Display',serif;font-size:22px;font-weight:900;line-height:1.3;color:#fff;max-width:280px}
    .drd-next-when{font-size:13px;color:#888;margin-top:-6px}
    .drd-next-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .drd-next-btn{padding:10px 20px;border-radius:22px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:inherit}
    .drd-next-btn.pri{background:var(--acc,#ff0050);color:#fff;box-shadow:0 0 18px var(--glow,rgba(255,0,80,.3))}
    .drd-next-btn.sec{background:rgba(255,255,255,.07);color:#aaa;border:1px solid rgba(255,255,255,.08)}
    .drd-sel-pop{position:fixed;z-index:1780;display:none;flex-direction:row;gap:2px;background:#0d0d14;border:1px solid rgba(0,170,255,.3);border-radius:14px;padding:6px 4px;box-shadow:0 8px 32px rgba(0,0,0,.95);transform:translateX(-50%)}
    .drd-sel-pop.show{display:flex}
    .drd-sel-btn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 13px;border-radius:9px;cursor:pointer;font-size:9px;font-weight:700;color:#aaa;border:none;background:transparent;font-family:inherit}
    .drd-sel-btn i{font-size:14px}
    .drd-q-ov{position:fixed;inset:0;z-index:1790;background:rgba(0,0,0,.95);display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;padding:16px}
    .drd-q-ov.open{display:flex}
    .drd-q-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.08);border:none;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10}
    .drd-q-wrap{width:100%;max-width:320px;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.8)}
    .drd-q-card{width:100%;aspect-ratio:9/16;max-height:60vh;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:36px 28px;text-align:center}
    .drd-q-card-bg{position:absolute;inset:0;background-size:cover;background-position:center}
    .drd-q-card-ov{position:absolute;inset:0;background:rgba(0,0,0,.68)}
    .drd-q-logo{position:absolute;top:16px;left:18px;font-family:'Playfair Display',serif;font-size:12px;font-weight:900;color:rgba(255,255,255,.35)}
    .drd-q-cnt{position:relative;z-index:4;display:flex;flex-direction:column;align-items:center;gap:12px}
    .drd-q-mark{font-family:'Playfair Display',serif;font-size:48px;color:var(--acc2,#ff4d7a);opacity:.5;line-height:1;margin-bottom:-12px;align-self:flex-start}
    .drd-q-text{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;line-height:1.55;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.5);text-align:center}
    .drd-q-div{width:40px;height:2px;background:var(--acc2,#ff4d7a);border-radius:2px;opacity:.7}
    .drd-q-writer{font-size:11px;font-weight:700;color:var(--acc2,#ff4d7a)}
    .drd-q-story{font-size:9px;color:rgba(255,255,255,.35);font-style:italic}
    .drd-q-droboard{position:absolute;bottom:14px;right:16px;font-size:8px;font-weight:800;color:rgba(255,255,255,.2);letter-spacing:.12em;text-transform:uppercase}
    .drd-q-acts{display:flex;gap:8px;justify-content:center;width:100%;max-width:300px}
    .drd-q-act-btn{flex:1;padding:11px 7px;border-radius:13px;font-size:11px;font-weight:700;cursor:pointer;border:none;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;color:#fff}
    .drd-q-share{background:var(--acc,#ff0050);box-shadow:0 4px 16px var(--glow,rgba(255,0,80,.3))}
    .drd-q-copy{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1)}
    .drd-cm-bg{position:fixed;inset:0;z-index:1800;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);display:none;align-items:flex-end;justify-content:center}
    .drd-cm-bg.open{display:flex}
    .drd-cm-sheet{width:100%;max-width:480px;max-height:88vh;background:#080808;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:drdUp .28s ease}
    @keyframes drdUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    .drd-cm-hdr{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 10px}
    .drd-cm-hdr h3{font-size:14px;font-weight:800;color:#e0e0e0;margin:0}
    .drd-cm-close{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:#888;border:none;flex-shrink:0}
    .drd-cm-body{flex:1;overflow-y:auto;padding:0 14px;scrollbar-width:none}
    .drd-cm-body::-webkit-scrollbar{display:none}

    /* ── Locked chapter / paywall ── */
    .drd-locked-slide{position:relative}
    .drd-locked-fade{max-height:56%;overflow:hidden;-webkit-mask-image:linear-gradient(to bottom, black 22%, transparent 92%);mask-image:linear-gradient(to bottom, black 22%, transparent 92%);opacity:.5;pointer-events:none;user-select:none}
    .drd-unlock-card{position:absolute;left:18px;right:18px;bottom:112px;z-index:6;background:rgba(10,10,13,.94);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,.08);border-radius:18px;padding:20px 16px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.65)}
    .drd-unlock-icon{width:44px;height:44px;border-radius:50%;background:rgba(255,0,80,.12);border:1.5px solid rgba(255,0,80,.3);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--acc,#ff0050);margin:0 auto 10px}
    .drd-unlock-title{font-family:'Playfair Display',serif;font-size:15px;font-weight:800;color:#fff;margin-bottom:5px}
    .drd-unlock-sub{font-size:11px;color:#888;line-height:1.5;margin-bottom:14px}
    .drd-unlock-opts{display:flex;flex-direction:column;gap:8px}
    .drd-unlock-opt{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 13px;border-radius:12px;border:1.5px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);cursor:pointer;transition:.15s}
    .drd-unlock-opt:active{transform:scale(.98)}
    .drd-unlock-opt.reco{border-color:rgba(255,0,80,.3);background:rgba(255,0,80,.08)}
    .drd-unlock-opt-lbl{text-align:left}
    .drd-unlock-opt-t{font-size:11px;font-weight:800;color:#fff}
    .drd-unlock-opt-s{font-size:9px;color:#666;margin-top:1px}
    .drd-unlock-opt-price{font-size:11px;font-weight:900;color:#fbbf24;display:flex;align-items:center;gap:4px;white-space:nowrap}
    .drd-unlock-opt.reco .drd-unlock-opt-price{color:var(--acc,#ff0050)}

    /* ── Insufficient balance modal ── */
    .drd-bal-ov{position:fixed;inset:0;z-index:1810;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:24px}
    .drd-bal-ov.open{display:flex}
    .drd-bal-card{width:100%;max-width:300px;background:#0a0a0d;border:1.5px solid rgba(255,255,255,.08);border-radius:20px;padding:26px 20px;text-align:center}
    .drd-bal-icon{width:48px;height:48px;border-radius:50%;background:rgba(217,119,6,.12);border:1.5px solid rgba(217,119,6,.35);display:flex;align-items:center;justify-content:center;font-size:20px;color:#d97706;margin:0 auto 12px}
    .drd-bal-title{font-family:'Playfair Display',serif;font-size:16px;font-weight:800;color:#fff;margin-bottom:6px}
    .drd-bal-sub{font-size:12px;color:#999;line-height:1.5;margin-bottom:18px}
    .drd-bal-sub b{color:#fff}
    .drd-bal-actions{display:flex;flex-direction:column;gap:8px}
    .drd-bal-btn{padding:11px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;border:none}
    .drd-bal-btn.pri{background:var(--acc,#ff0050);color:#fff}
    .drd-bal-btn.sec{background:rgba(255,255,255,.05);color:#888;border:1px solid rgba(255,255,255,.08)}

    /* ── Buy coins sheet ── */
    .drd-buy-ov{position:fixed;inset:0;z-index:1810;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:none;align-items:flex-end;justify-content:center}
    .drd-buy-ov.open{display:flex}
    .drd-buy-sheet{position:relative;width:100%;max-width:480px;background:#0a0a0d;border:1px solid rgba(255,255,255,.08);border-radius:20px 20px 0 0;padding:0 0 24px;max-height:80vh;overflow-y:auto;scrollbar-width:none}
    .drd-buy-sheet::-webkit-scrollbar{display:none}
    .drd-buy-loading{position:absolute;inset:0;background:rgba(10,10,13,.94);display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:20px 20px 0 0;z-index:6}
    .drd-buy-loading.show{display:flex}
    .drd-buy-spin{width:30px;height:30px;border-radius:50%;border:3px solid rgba(255,255,255,.1);border-top-color:var(--acc,#ff0050);animation:drdspin .8s linear infinite}
    @keyframes drdspin{to{transform:rotate(360deg)}}
    .drd-buy-hdr{display:flex;align-items:center;gap:10px;padding:14px 16px}
    .drd-buy-title{font-family:'Playfair Display',serif;font-size:15px;font-weight:800;color:#fff;flex:1}
    .drd-buy-bal{font-size:11px;font-weight:700;color:#fbbf24;display:flex;align-items:center;gap:5px;white-space:nowrap}
    .drd-buy-close{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:#888;border:none;flex-shrink:0}
    .drd-buy-tabs{display:flex;gap:8px;padding:0 16px 12px}
    .drd-buy-tab{flex:1;text-align:center;padding:8px;border-radius:10px;font-size:11px;font-weight:700;color:#888;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.07);cursor:pointer}
    .drd-buy-tab.on{background:rgba(255,0,80,.12);border-color:rgba(255,0,80,.3);color:var(--acc2,#ff4d7a)}
    .drd-buy-body{padding:0 16px 4px}
    .drd-pkg{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;border-radius:13px;border:1.5px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);margin-bottom:8px;cursor:pointer}
    .drd-pkg:active{transform:scale(.98)}
    .drd-pkg.reco{border-color:rgba(255,0,80,.3);background:rgba(255,0,80,.08)}
    .drd-pkg-coins{font-size:13px;font-weight:900;color:#fff;display:flex;align-items:center;gap:6px}
    .drd-pkg-coins i{color:#d97706;font-size:12px}
    .drd-pkg-bonus{font-size:9px;font-weight:700;color:#22c55e;margin-top:2px}
    .drd-pkg-lbl{font-size:9px;font-weight:800;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
    .drd-pkg-right{text-align:right}
    .drd-pkg-price{font-size:12px;font-weight:800;color:#fff}
    .drd-fund-lbl{font-size:10px;font-weight:800;color:#666;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
    .drd-fund-inp{width:100%;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.08);border-radius:11px;padding:11px 13px;color:#fff;font-family:inherit;font-size:14px;font-weight:700;outline:none;margin-bottom:8px}
    .drd-fund-rate{font-size:10px;color:#666;margin-bottom:16px}
    .drd-buy-cta{width:100%;padding:12px;border-radius:13px;background:var(--acc,#ff0050);color:#fff;font-weight:800;font-size:12px;cursor:pointer;border:none;font-family:inherit}

    .drd-toast{position:fixed;bottom:88px;left:50%;transform:translateX(-50%) translateY(16px);background:#111;border:1px solid rgba(255,255,255,.08);color:#e0e0e0;padding:8px 18px;border-radius:24px;font-size:12px;font-weight:600;z-index:2000;opacity:0;transition:.28s;pointer-events:none;white-space:nowrap;font-family:inherit}
    .drd-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  `;

  const DEFAULT_ADS = [
    { brand: 'Konga', logo: 'https://i.pravatar.cc/100?img=20', headline: 'Shop smarter this season', body: 'Thousands of deals on fashion and electronics.', cta: 'Shop Now', url: 'https://konga.com' },
    { brand: 'PiggyVest', logo: 'https://i.pravatar.cc/100?img=23', headline: 'Save money. Build your future.', body: 'Join 4 million Nigerians saving smarter every day.', cta: 'Start Saving', url: 'https://piggyvest.com' },
  ];

  const COIN_PACKAGES = [
    { coins: 100, bonus: 0, price: 500, label: 'Starter' },
    { coins: 300, bonus: 20, price: 1200, label: 'Popular', reco: true },
    { coins: 700, bonus: 80, price: 2500, label: 'Best Value' },
    { coins: 1500, bonus: 250, price: 5000, label: 'Mega' },
  ];

  // Locking is now per-CHAPTER, not per-scene: a story/chapter is either
  // fully open or fully locked. One flat cost unlocks the whole thing.
  const DEFAULT_CHAPTER_UNLOCK_COST = 30;

  function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _fmtN(n) { n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function _readTime(scenes) { return Math.max(1, Math.ceil((scenes || []).join(' ').split(/\s+/).length / 200)); }
  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    let el = document.getElementById('drd-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  let _hooks = {};
  let _built = false;
  let _curStory = null;
  let _commentsCache = {};
  let _activeCommentInstance = null;
  let selStory = null;
  let qText = '', qStory = null;

  // ── Wallet / paywall state (self-contained demo, overridable via hooks) ──
  let _wallet = { balance: 0 };
  let _buyPurchasing = false;
  let _pendingInsufficientRetry = null;
  let _pendingBuyRetry = null;

  // ── Chrome auto-hide state (title/synopsis block only) ──
  let _lastChromeIdx = null;
  let _chromeApplicable = false;
  let _chromeRevealTimer = null;

  const RING_MAP = { 'ring-has': 'has', 'ring-viewed': 'viewed', 'ring-none': 'none' };
  const RX_ID_MAP = { fire: 'savage', cry: 'crying', broken: 'broken', shock: 'shocked', mindblown: 'twist', emo: 'emotional', sus: 'sus', clap: 'laughing' };

  function _mapRawComment(raw) {
    const rx = { userRx: null };
    if (raw.reactions) {
      Object.keys(raw.reactions).forEach(k => {
        if (k === 'userRx') { rx.userRx = raw.reactions.userRx ? (RX_ID_MAP[raw.reactions.userRx] || raw.reactions.userRx) : null; return; }
        const mapped = RX_ID_MAP[k] || k;
        rx[mapped] = (rx[mapped] || 0) + (raw.reactions[k] || 0);
      });
    }
    let statuses = null;
    if (raw.wid && typeof WRITER_STATUS !== 'undefined' && WRITER_STATUS[raw.wid] && WRITER_STATUS[raw.wid].statuses) {
      statuses = WRITER_STATUS[raw.wid].statuses;
    }
    return {
      id: raw.id,
      name: raw.name,
      avatar: raw.avatar,
      verified: raw.verified ? (raw.wid ? 'writer' : 'reader') : false,
      team: raw.team || null,
      statusRing: RING_MAP[raw.statusRing] || 'none',
      statuses,
      time: raw.time,
      text: raw.text,
      likes: raw.likes || 0,
      liked: !!raw.liked,
      rx,
      replies: (raw.replies || []).map(_mapRawComment),
    };
  }

  function _seedComments(storyId) {
    const source = (_hooks.comments && _hooks.comments.data)
      || (typeof COMMENTS_DATA !== 'undefined' ? COMMENTS_DATA : []);
    const seeded = source.map(_mapRawComment);
    _commentsCache[storyId] = seeded;
    return seeded;
  }

  function _build() {
    if (_built) return;
    _built = true;

    const style = document.createElement('style');
    style.id = 'drd-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="drd-ov" id="drdOv">
        <div class="drd-prog"><div class="drd-prog-fill" id="drdProg"></div></div>
        <div class="drd-hdr">
          <div class="drd-close" id="drdClose">✕</div>
          <div class="drd-hdr-right">
            <div class="drd-meta">
              <span><i class="far fa-heart"></i> <span id="drdLikes">0</span></span>
              <span><i class="far fa-comment"></i> <span id="drdCmts">0</span></span>
              <span id="drdTime">📖 1 min</span>
            </div>
          </div>
        </div>
        <div class="drd-title-blk" id="drdTitleBlk" style="opacity:0">
          <div class="drd-story-t" id="drdStoryT"></div>
          <div class="drd-meta-row">
            <div class="drd-ch" id="drdCh"></div>
            <button class="drd-full-btn" id="drdFullBtn">Read Full</button>
          </div>
          <div class="drd-syn-btn" id="drdSynBtn"><i class="fas fa-book-open"></i> Synopsis</div>
        </div>
        <div class="drd-slides" id="drdSlides"></div>

        <div class="drd-bottom" id="drdBottom">
          <div class="drd-icons">
            <div class="drd-rx-slot" id="drdRxSlot"></div>
            <div class="drd-act" id="drdCmtAct"><div class="drd-act-ico"><i class="fas fa-comment-dots"></i></div><span id="drdCmtLbl">0</span></div>
            <div class="drd-act" id="drdSaveAct"><div class="drd-act-ico"><i class="far fa-bookmark"></i></div><span>Save</span></div>
            <div class="drd-act" id="drdShareAct"><div class="drd-act-ico"><i class="fas fa-share-nodes"></i></div><span>Share</span></div>
            <div class="drd-act tip" id="drdTipAct"><div class="drd-act-ico"><i class="fas fa-coins"></i></div><span>Tip</span></div>
          </div>
        </div>
      </div>

      <div class="drd-sel-pop" id="drdSelPop">
        <button class="drd-sel-btn" id="drdSelShare"><i class="fas fa-share-alt"></i>Share</button>
        <button class="drd-sel-btn" id="drdSelSave"><i class="far fa-bookmark"></i>Save</button>
        <button class="drd-sel-btn" id="drdSelCopy"><i class="far fa-copy"></i>Copy</button>
      </div>

      <div class="drd-q-ov" id="drdQOv">
        <button class="drd-q-close" id="drdQClose">✕</button>
        <div class="drd-q-wrap"><div class="drd-q-card" id="drdQCard">
          <div class="drd-q-card-bg" id="drdQBg"></div>
          <div class="drd-q-card-ov"></div>
          <div class="drd-q-logo">Droboard</div>
          <div class="drd-q-cnt">
            <div class="drd-q-mark">"</div>
            <div class="drd-q-text" id="drdQTxt"></div>
            <div class="drd-q-div"></div>
            <div class="drd-q-writer" id="drdQWriter"></div>
            <div class="drd-q-story" id="drdQStory"></div>
          </div>
          <div class="drd-q-droboard">droboard.app</div>
        </div></div>
        <div class="drd-q-acts">
          <button class="drd-q-act-btn drd-q-share" id="drdQShare"><i class="fas fa-share-alt"></i> Share Quote</button>
          <button class="drd-q-act-btn drd-q-copy" id="drdQCopy"><i class="far fa-copy"></i> Copy</button>
        </div>
      </div>

      <div class="drd-cm-bg" id="drdCmBg">
        <div class="drd-cm-sheet">
          <div class="drd-cm-hdr"><h3>Comments</h3><button class="drd-cm-close" id="drdCmClose">✕</button></div>
          <div class="drd-cm-body" id="drdCmBody"></div>
        </div>
      </div>

      <!-- Insufficient balance modal -->
      <div class="drd-bal-ov" id="drdBalOv">
        <div class="drd-bal-card">
          <div class="drd-bal-icon"><i class="fas fa-wallet"></i></div>
          <div class="drd-bal-title">Not Enough Coins</div>
          <div class="drd-bal-sub">You need <b id="drdBalNeed">0</b> coins for this, but your wallet only has <b id="drdBalHave">0</b>.</div>
          <div class="drd-bal-actions">
            <button class="drd-bal-btn pri" id="drdBalBuyBtn"><i class="fas fa-coins"></i> Buy Coins</button>
            <button class="drd-bal-btn sec" id="drdBalCancelBtn">Maybe Later</button>
          </div>
        </div>
      </div>

      <!-- Buy coins / fund wallet sheet -->
      <div class="drd-buy-ov" id="drdBuyOv">
        <div class="drd-buy-sheet">
          <div class="drd-buy-loading" id="drdBuyLoading">
            <div class="drd-buy-spin"></div>
            <div id="drdBuyLoadingText" style="color:#aaa;font-size:12px;font-weight:600">Processing purchase…</div>
          </div>
          <div class="drd-buy-hdr">
            <div class="drd-buy-title">Get More Coins</div>
            <div class="drd-buy-bal"><i class="fas fa-coins"></i> <span id="drdBuyBal">0</span></div>
            <button class="drd-buy-close" id="drdBuyClose">✕</button>
          </div>
          <div class="drd-buy-tabs">
            <div class="drd-buy-tab on" data-tab="packages">Coin Packages</div>
            <div class="drd-buy-tab" data-tab="fund">Fund Wallet</div>
          </div>
          <div class="drd-buy-body" id="drdBuyPackages"></div>
          <div class="drd-buy-body" id="drdBuyFund" style="display:none">
            <div class="drd-fund-lbl">Enter amount (₦)</div>
            <input class="drd-fund-inp" id="drdFundInp" type="number" min="100" placeholder="e.g. 1000"/>
            <div class="drd-fund-rate">₦20 = 1 coin · minimum ₦100</div>
            <button class="drd-buy-cta" id="drdFundConfirm">Fund &amp; Convert</button>
          </div>
        </div>
      </div>

      <div class="drd-toast" id="drd-toast"></div>
    `;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    if (typeof window.DroboardTip !== 'undefined') window.DroboardTip.attach(_hooks.tip || {});

    _bindStaticEvents();
  }

  /* ── Story-level reaction: ONE plain heart, no popup, no multi-emoji
     preview — matches the sizing of Comment/Save/Share/Tip exactly since
     it reuses the same .drd-act/.drd-act-ico markup. ── */
function _renderRxSlot(story) {
  const slot = document.getElementById('drdRxSlot');
  if (!slot) return;
  
  if (typeof window.DroboardReactionPicker !== 'undefined') {
    slot.innerHTML = window.DroboardReactionPicker.renderTrigger('story-' + story.id, {
      icon: 'heart',
      liked: story.liked || false,
      likeCount: (story.stats && story.stats.likes) || 0
    });
  } else {
    // Fallback: simple like button
    slot.innerHTML = `<div class="drd-act${story.liked ? ' liked' : ''}" id="drdLikeBtn">
      <div class="drd-act-ico"><i class="${story.liked ? 'fas' : 'far'} fa-heart"></i></div>
      <span>${_fmtN((story.stats && story.stats.likes) || 0)}</span>
    </div>`;
    document.getElementById('drdLikeBtn')?.addEventListener('click', () => {
      story.liked = !story.liked;
      story.stats.likes = (story.stats.likes || 0) + (story.liked ? 1 : -1);
      _renderRxSlot(story);
      _syncHeaderMeta(story);
    });
  }
}
  function _syncHeaderMeta(story) {
    document.getElementById('drdLikes').textContent = _fmtN((story.stats && story.stats.likes) || 0);
    document.getElementById('drdCmts').textContent = _fmtN((story.stats && story.stats.comments) || 0);
    document.getElementById('drdCmtLbl').textContent = _fmtN((story.stats && story.stats.comments) || 0);
    document.getElementById('drdTime').textContent = `📖 ${_readTime(story.scenes)} min`;
  }

  function _bumpCommentCount(story, delta) {
    story.stats = story.stats || {};
    story.stats.comments = Math.max(0, (story.stats.comments || 0) + delta);
    _syncHeaderMeta(story);
  }

  function openComments(story) {
    if (typeof window.DroboardComments === 'undefined') {
      _toast('💬 Comments coming soon');
      return;
    }
    const container = document.getElementById('drdCmBody');
    const seed = _commentsCache[story.id] || _seedComments(story.id);
    const cOpts = _hooks.comments || {};

    const cs = window.DroboardComments.attach(container, {
      title: 'Comments',
      comments: seed,
      teams: cOpts.teams,
      currentUser: cOpts.currentUser || { name: 'You', avatar: null },
      requireTeam: cOpts.requireTeam || false,
      collapsible: false,
      startOpen: true,
      onPost: () => _bumpCommentCount(story, 1),
      onReply: () => _bumpCommentCount(story, 1),
      onDotsAction: (action) => { if (action === 'delete') _bumpCommentCount(story, -1); },
      getCommentUrl: (c) => (typeof _hooks.getCommentUrl === 'function'
        ? _hooks.getCommentUrl(story, c)
        : `${location.href.split('#')[0]}#story-${story.id}-comment-${c.id}`),
    });

    _activeCommentInstance = { storyId: story.id, cs };
    document.getElementById('drdCmBg').classList.add('open');
  }
  function closeComments() {
    if (_activeCommentInstance) {
      _commentsCache[_activeCommentInstance.storyId] = _activeCommentInstance.cs.getComments();
      _activeCommentInstance.cs.destroy();
      _activeCommentInstance = null;
    }
    document.getElementById('drdCmBg').classList.remove('open');
  }

  function _setupSelection(story) {
    selStory = story;
    function onSel() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim().length < 8) { _hideSelPop(); return; }
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const text = sel.toString().trim();
        if (text.length < 8) { _hideSelPop(); return; }
        const pop = document.getElementById('drdSelPop');
        pop._t = text;
        pop.style.left = Math.min(Math.max(rect.left + rect.width / 2, 80), window.innerWidth - 80) + 'px';
        pop.style.top = Math.max(rect.top - 10, 60) + 'px';
        pop.classList.add('show');
      } catch (e) { _hideSelPop(); }
    }
    document.addEventListener('selectionchange', onSel);
    window.__drdCleanSel = () => { document.removeEventListener('selectionchange', onSel); _hideSelPop(); selStory = null; };
  }
  function _hideSelPop() { document.getElementById('drdSelPop').classList.remove('show'); }

  function _openQuoteOv(text, story) {
    qText = text; qStory = story;
    document.getElementById('drdQBg').style.backgroundImage = `url('${story.cover}')`;
    document.getElementById('drdQTxt').textContent = `"${text}"`;
    document.getElementById('drdQWriter').textContent = `— @${(story.writer && story.writer.name) || 'writer'}`;
    document.getElementById('drdQStory').textContent = story.title.length > 50 ? story.title.substring(0, 50) + '…' : story.title;
    document.getElementById('drdQOv').classList.add('open');
  }
  function _closeQuoteOv() { document.getElementById('drdQOv').classList.remove('open'); qText = ''; qStory = null; }

  function _quoteUrl(story) {
    return (typeof _hooks.getStoryUrl === 'function') ? _hooks.getStoryUrl(story) : `https://droboard.app/story/${story.id}`;
  }

  function _typeChBadge(story) {
    if (story.type === 'poem') return '🌙 Poem';
    if (story.type === 'short') return '✨ Short Story';
    return `Season ${story.season} · Chapter ${story.chapter}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     WALLET / PAYWALL — self-contained demo, overridable via hooks:
       hooks.onUnlockAttempt(story, 0, sceneCount, cost, callback)
         → call callback(true) to grant, callback(false) to deny/no-op.
           If omitted, an internal demo wallet handles it (deduct + a
           real Buy Coins round-trip when balance is short).
       hooks.onBuyCoins(package) → return { ok, coins? } or a Promise of
         that shape. If omitted, purchases are simulated locally.
  ══════════════════════════════════════════════════════════════════ */
  function _syncWalletUI() {
    const bal2 = document.getElementById('drdBuyBal');
    if (bal2) bal2.textContent = _fmtN(_wallet.balance);
  }

  function _openInsufficientBalance(need, have, retryFn) {
    _pendingInsufficientRetry = retryFn || null;
    document.getElementById('drdBalNeed').textContent = need;
    document.getElementById('drdBalHave').textContent = have;
    document.getElementById('drdBalOv').classList.add('open');
  }
  function _closeInsufficientBalance() { document.getElementById('drdBalOv').classList.remove('open'); }

  function _openBuyCoins(retryFn) {
    _pendingBuyRetry = retryFn || null;
    _renderCoinPackages();
    _syncWalletUI();
    _setBuyTab('packages');
    document.getElementById('drdBuyOv').classList.add('open');
    if (_buyPurchasing) _setBuyLoading(true);
  }
  function _closeBuyCoins() {
    if (_buyPurchasing) return;
    document.getElementById('drdBuyOv').classList.remove('open');
  }
  function _setBuyTab(tab) {
    document.querySelectorAll('.drd-buy-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
    document.getElementById('drdBuyPackages').style.display = tab === 'packages' ? '' : 'none';
    document.getElementById('drdBuyFund').style.display = tab === 'fund' ? '' : 'none';
  }
  function _renderCoinPackages() {
    document.getElementById('drdBuyPackages').innerHTML = COIN_PACKAGES.map((p, i) => `
      <div class="drd-pkg${p.reco ? ' reco' : ''}" data-pkgidx="${i}">
        <div>
          <div class="drd-pkg-lbl">${_esc(p.label)}</div>
          <div class="drd-pkg-coins"><i class="fas fa-coins"></i> ${_fmtN(p.coins)}</div>
          ${p.bonus ? `<div class="drd-pkg-bonus">+${p.bonus} bonus coins</div>` : ''}
        </div>
        <div class="drd-pkg-right"><div class="drd-pkg-price">₦${_fmtN(p.price)}</div></div>
      </div>`).join('');
  }
  function _setBuyLoading(loading) {
    _buyPurchasing = loading;
    document.getElementById('drdBuyLoading').classList.toggle('show', loading);
  }
  function _grantCoins(amount) {
    _wallet.balance += amount;
    _syncWalletUI();
    _toast(`🪙 ${_fmtN(amount)} coins added to your wallet!`);
    _setBuyLoading(false);
    _closeBuyCoins();
    if (_pendingBuyRetry) { const fn = _pendingBuyRetry; _pendingBuyRetry = null; setTimeout(fn, 150); }
  }
  function _buyPackage(i) {
    if (_buyPurchasing) return;
    const p = COIN_PACKAGES[i];
    if (!p) return;
    if (typeof _hooks.onBuyCoins === 'function') {
      _setBuyLoading(true);
      Promise.resolve(_hooks.onBuyCoins(p)).then(res => {
        if (res && res.ok) _grantCoins((res.coins != null ? res.coins : p.coins) + (p.bonus || 0));
        else { _setBuyLoading(false); _toast('❌ ' + (res && res.message ? res.message : 'Purchase failed')); }
      }).catch(() => { _setBuyLoading(false); _toast('❌ Purchase failed'); });
      return;
    }
    _setBuyLoading(true);
    setTimeout(() => _grantCoins(p.coins + (p.bonus || 0)), 1000);
  }
  function _fundWallet() {
    if (_buyPurchasing) return;
    const naira = +document.getElementById('drdFundInp').value;
    if (!naira || naira < 100) { _toast('Enter at least ₦100'); return; }
    document.getElementById('drdFundInp').value = '';
    _setBuyLoading(true);
    setTimeout(() => _grantCoins(Math.floor(naira / 20)), 900);
  }

  /* ── Per-CHAPTER unlock (not per-scene): one decision unlocks every
     scene in this story/chapter at once. ── */
  function _attemptUnlockChapter(story, cost) {
    if (typeof _hooks.onUnlockAttempt === 'function') {
      _hooks.onUnlockAttempt(story, 0, story.scenes.length, cost, (ok) => { if (ok) _applyChapterUnlock(story); });
      return;
    }
    if (_wallet.balance < cost) {
      _openInsufficientBalance(cost, _wallet.balance, () => _attemptUnlockChapter(story, cost));
      return;
    }
    _wallet.balance -= cost;
    _syncWalletUI();
    _applyChapterUnlock(story);
  }
  function _applyChapterUnlock(story) {
    story.locked = false;
    story.unlockedThrough = story.scenes.length;
    _rebuildAfterChapterUnlock(story);
    _toast('🔓 Chapter unlocked!');
  }
  function _rebuildAfterChapterUnlock(story) {
    const slidesEl = document.getElementById('drdSlides');
    const lockedEl = slidesEl.querySelector('.drd-locked-slide');
    if (!lockedEl) return;
    const total = story.scenes.length;
    const adsPool = (_hooks.ads && _hooks.ads.length) ? _hooks.ads : DEFAULT_ADS;
    let html = '';
    story.scenes.forEach((scene, i) => {
      html += _buildSceneSlideHtml(story, i, total);
      if (i === 1) html += _buildAdSlide(adsPool[story.id % adsPool.length]);
    });
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const frag = document.createDocumentFragment();
    while (tmp.firstChild) frag.appendChild(tmp.firstChild);
    lockedEl.replaceWith(frag);
    slidesEl.querySelectorAll('.drd-ad-cta').forEach(btn => {
      if (btn._drdBound) return;
      btn._drdBound = true;
      btn.addEventListener('click', () => { if (btn.dataset.adUrl) window.open(btn.dataset.adUrl, '_blank'); });
    });
    const skipEl = document.getElementById('drdAdSkip');
    if (skipEl && !skipEl._drdBound) {
      skipEl._drdBound = true;
      skipEl.addEventListener('click', () => {
        slidesEl.scrollTo({ left: slidesEl.scrollLeft + slidesEl.offsetWidth, behavior: 'smooth' });
      });
    }
    _onScroll();
  }

  function _buildSceneSlideHtml(story, i, total) {
    return `<div class="drd-slide" data-si="${i}"><div class="drd-scene-box"><div class="drd-scene-txt">${_esc(story.scenes[i])}</div><div class="drd-scene-num">✦ ${i + 1} / ${total}</div></div></div>`;
  }

  function _buildChapterLockSlide(story) {
    const preview = story.scenes[0] || '';
    const cost = story.unlockCost || DEFAULT_CHAPTER_UNLOCK_COST;
    const bundle = story.unlockBundle; // optional { label, sub, cost }
    return `<div class="drd-slide drd-locked-slide" data-si="0">
      <div class="drd-scene-box"><div class="drd-scene-txt drd-locked-fade">${_esc(preview)}</div></div>
      <div class="drd-unlock-card">
        <div class="drd-unlock-icon"><i class="fas fa-lock"></i></div>
        <div class="drd-unlock-title">Chapter Locked</div>
        <div class="drd-unlock-sub">Unlock this chapter to keep reading — the whole thing, all at once.</div>
        <div class="drd-unlock-opts">
          <div class="drd-unlock-opt reco" data-unlockchapter="1" data-cost="${cost}">
            <div class="drd-unlock-opt-lbl"><div class="drd-unlock-opt-t">Unlock This Chapter</div><div class="drd-unlock-opt-s">${story.scenes.length} scene${story.scenes.length === 1 ? '' : 's'}</div></div>
            <div class="drd-unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> ${cost}</div>
          </div>
          ${bundle ? `<div class="drd-unlock-opt" data-unlockchapter="1" data-cost="${bundle.cost}">
            <div class="drd-unlock-opt-lbl"><div class="drd-unlock-opt-t">${_esc(bundle.label)}</div><div class="drd-unlock-opt-s">${_esc(bundle.sub || '')}</div></div>
            <div class="drd-unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> ${bundle.cost}</div>
          </div>` : ''}
        </div>
      </div>
    </div>`;
  }

  function _buildCoverSlide(story, eng) {
    const hasPoll = !!(eng && eng.poll), hasDebate = !!(eng && eng.debate), hasNext = !!(eng && eng.hasNext) && story.type === 'series';
    return `<div class="drd-slide drd-cover-sl">
      <div class="drd-cover-bg" style="background-image:url('${story.cover}')"></div>
      <div class="drd-overlay-grad"></div>
      <div class="drd-cover-cnt">
        <div class="drd-cov-cat">${_esc(story.cat || '')}</div>
        <div class="drd-cov-title">${_esc(story.title)}</div>
        <div class="drd-cov-ch">${_typeChBadge(story)}</div>
        <div class="drd-cov-syn-wrap">
          <div class="drd-cov-syn" id="drdCovSyn">${_esc(story.synopsis || '')}</div>
          <span class="drd-cov-see-more" id="drdCovSeeMore">See more ›</span>
        </div>
        <div class="drd-cov-actions">
          <button class="drd-cov-start" id="drdCovStart">Start Reading →</button>
          <button class="drd-cov-full" id="drdCovFull"><i class="fas fa-book-open" style="font-size:10px"></i> Read Full Story</button>
          <div class="drd-cov-pills">
            ${hasPoll ? `<button class="drd-cov-pill" id="drdPillPoll">📊 Poll</button>` : `<button class="drd-cov-pill off">📊 Poll</button>`}
            ${hasDebate ? `<button class="drd-cov-pill" id="drdPillDebate">⚔️ Debate</button>` : `<button class="drd-cov-pill off">⚔️ Debate</button>`}
            ${hasNext ? `<button class="drd-cov-pill" id="drdPillNext">🔔 Next Chapter</button>` : `<button class="drd-cov-pill off">🔔 Next Chapter</button>`}
          </div>
        </div>
      </div>
    </div>`;
  }

  function _buildAdSlide(ad) {
    return `<div class="drd-ad-slide"><div class="drd-ad-inn">
      <div class="drd-ad-sp">📢 SPONSORED · ${_esc(ad.brand)}</div>
      <img class="drd-ad-logo" src="${ad.logo}" loading="lazy"/>
      <div class="drd-ad-brand">${_esc(ad.brand)}</div>
      <div class="drd-ad-h">${_esc(ad.headline)}</div>
      <div class="drd-ad-b">${_esc(ad.body)}</div>
      <button class="drd-ad-cta" data-ad-url="${ad.url || ''}">${_esc(ad.cta)}</button>
      <div class="drd-ad-skip" id="drdAdSkip">Skip ›</div>
    </div></div>`;
  }

  function _buildPollSlide(story, eng) {
    const p = eng.poll;
    const tot = p.opts.reduce((s, o) => s + o.v, 0) || 1;
    return `<div class="drd-eng-sl" id="drdPollSl"><div class="drd-eng-inner">
      <div class="drd-eng-tag">📊 Reader Poll</div>
      <div class="drd-eng-title">${_esc(p.q)}</div>
      <div class="drd-eng-card"><div class="drd-eng-opts">${p.opts.map((o, i) => {
        const pct = Math.round(o.v / tot * 100);
        return `<div class="drd-eng-opt${p.voted === i ? ' voted' : ''}" data-oi="${i}"><div class="drd-eng-opt-bar" style="width:${pct}%"></div><div class="drd-eng-opt-row"><span class="drd-eng-opt-txt">${_esc(o.t)}</span><span class="drd-eng-opt-pct">${pct}%</span></div></div>`;
      }).join('')}</div>
      <div class="drd-eng-foot"><span class="drd-eng-total">${_fmtN(tot)} votes</span><span class="drd-eng-share" id="drdPollShare"><i class="fas fa-share-alt"></i> Share</span></div></div>
    </div></div>`;
  }

  function _buildDebateSlide(story, eng) {
    const d = eng.debate;
    const tot = (d.forV + d.agV) || 1;
    const fp = Math.round(d.forV / tot * 100), ap = 100 - fp;
    const first = (d.comments || [])[0];
    const meta = story.type !== 'series' ? (story.type === 'poem' ? '🌙 Poem' : '✨ Short Story') : `S${story.season}·Ch${story.chapter}`;
    const cmHtml = first ? `<div class="drd-dcm-row">${first.avatar ? `<img class="drd-dcm-av" src="${first.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover" loading="lazy"/>` : `<div class="drd-dcm-av">${_esc((first.name || '?')[0])}</div>`}<div class="drd-dcm-body"><div class="drd-dcm-nm">${_esc(first.name)}<span class="drd-dcm-side ${first.side}">${first.side === 'for' ? '✅ FOR' : '❌ AGAINST'}</span></div><div class="drd-dcm-txt">${_esc(first.text)}</div><div class="drd-dcm-meta"><span class="drd-dcm-time">${_esc(first.time)}</span><span class="drd-dcm-like${first.liked ? ' liked' : ''}" data-cid="${first.id}"><i class="${first.liked ? 'fas' : 'far'} fa-heart"></i> ${first.likes}</span></div></div></div>` : '';
    return `<div class="drd-eng-sl" id="drdDebSl"><div class="drd-eng-inner">
      <div class="drd-eng-tag">⚔️ Reader Debate · ${meta}</div>
      <div class="drd-eng-title">"${_esc(d.motion)}"</div>
      <div class="drd-eng-card">
        <div class="drd-deb-sides">
          <div class="drd-d-side for${d.userVote === 'for' ? ' chosen' : ''}" data-side="for"><div class="drd-d-side-em">✅</div><div class="drd-d-side-lbl">FOR</div><div class="drd-d-bar-wrap"><div class="drd-d-bar" style="width:${fp}%"></div></div><div class="drd-d-pct">${fp}%</div><div class="drd-d-cnt">${_fmtN(d.forV)} readers</div></div>
          <div class="drd-d-side against${d.userVote === 'against' ? ' chosen' : ''}" data-side="against"><div class="drd-d-side-em">❌</div><div class="drd-d-side-lbl">AGAINST</div><div class="drd-d-bar-wrap"><div class="drd-d-bar" style="width:${ap}%"></div></div><div class="drd-d-pct">${ap}%</div><div class="drd-d-cnt">${_fmtN(d.agV)} readers</div></div>
        </div>
        <div class="drd-d-total-row"><i class="fas fa-fire" style="color:var(--acc,#ff0050)"></i> ${_fmtN(d.forV + d.agV)} readers debating</div>
        <div class="drd-d-acts-row"><button class="drd-d-act-btn share" id="drdDebShare"><i class="fas fa-share-alt"></i> Share</button><button class="drd-d-act-btn open" id="drdDebOpen"><i class="fas fa-external-link-alt"></i> Full Debate</button></div>
        ${cmHtml ? `<div class="drd-d-cm-sec"><div class="drd-d-cm-lbl">💬 Top Argument</div><div class="drd-d-cm-list" id="drdDebCmList">${cmHtml}</div></div>` : ''}
        <div class="drd-d-inp-row"><input class="drd-d-inp" id="drdDebInp" placeholder="${d.userVote ? 'Add your argument…' : 'Pick a side first…'}" ${!d.userVote ? 'disabled' : ''}/><button class="drd-d-post-btn" id="drdDebPost">Post</button></div>
      </div>
    </div></div>`;
  }

  function _buildNextSlide(story) {
    return `<div class="drd-next-sl" id="drdNextSl">
      <div class="drd-next-glow">🔔</div>
      <div class="drd-next-badge">✦ What's Next ✦</div>
      <div class="drd-next-title">Chapter ${(story.chapter || 0) + 1} dropping soon</div>
      <div class="drd-next-when">Don't miss it</div>
      <div class="drd-next-btns">
        <button class="drd-next-btn pri" id="drdNotifyBtn">🔔 Notify Me</button>
        <button class="drd-next-btn sec" id="drdNextShare">📤 Share</button>
      </div>
    </div>`;
  }

  /* ── Chrome (title/synopsis block) — tap toggles it instantly.
     Scene/ad/locked slides only; poll/debate/next/end/cover slides
     have their own always-visible content instead. ── */
  function _isChromeApplicableSlide(slideEl) {
    if (!slideEl) return false;
    if (slideEl.classList.contains('drd-cover-sl')) return false;
    if (slideEl.classList.contains('drd-eng-sl')) return false;
    if (slideEl.classList.contains('drd-next-sl')) return false;
    if (slideEl.classList.contains('drd-end-sl')) return false;
    return true; // scene slides, locked-chapter slide, ad slides
  }
  function _hideChromeNow() {
    const blk = document.getElementById('drdTitleBlk');
    if (blk) blk.style.opacity = '0';
  }
  function _showChromeFor3s() {
    const blk = document.getElementById('drdTitleBlk');
    if (blk) blk.style.opacity = '1';
    clearTimeout(_chromeRevealTimer);
    _chromeRevealTimer = setTimeout(_hideChromeNow, 3000);
  }
  function _isChromeVisible() {
    const blk = document.getElementById('drdTitleBlk');
    return !!blk && blk.style.opacity === '1';
  }
  function _toggleChrome() {
    if (_isChromeVisible()) {
      clearTimeout(_chromeRevealTimer);
      _hideChromeNow();
    } else {
      _showChromeFor3s();
    }
  }

  function _jmp(selector) {
    const slidesEl = document.getElementById('drdSlides');
    const el = slidesEl.querySelector(selector);
    if (el) slidesEl.scrollTo({ left: el.offsetLeft, behavior: 'smooth' });
  }

  function open(story, opts) {
    _build();
    opts = opts || {};
    _curStory = story;
    story.stats = story.stats || { likes: 0, comments: 0 };

    // Locking is binary and per-chapter: story.locked === true means the
    // whole chapter is locked; otherwise it's fully readable.
    if (story.locked) {
      story.unlockedThrough = 0;
    } else {
      story.unlockedThrough = story.scenes.length;
    }
    _setupSelection(story);

    const eng = story.engagement || {};
    const hasPoll = !!eng.poll, hasDebate = !!eng.debate, hasNext = !!eng.hasNext && story.type === 'series';
    const adsPool = (_hooks.ads && _hooks.ads.length) ? _hooks.ads : DEFAULT_ADS;
    const total = story.scenes.length;
    const isLocked = story.unlockedThrough <= 0 && total > 0;

    let html = _buildCoverSlide(story, eng);

    if (isLocked) {
      html += _buildChapterLockSlide(story);
    } else {
      story.scenes.forEach((scene, i) => {
        html += _buildSceneSlideHtml(story, i, total);
        if (i === 1) html += _buildAdSlide(adsPool[story.id % adsPool.length]);
      });
    }

    if (hasPoll) html += _buildPollSlide(story, eng);
    if (hasDebate) html += _buildDebateSlide(story, eng);
    if (hasNext) html += _buildNextSlide(story);

    html += `<div class="drd-slide drd-end-sl" style="background:#000"><div class="drd-end-box">
      <div style="font-size:40px">📖</div>
      <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:900;margin:8px 0">${story.type !== 'series' ? 'Story Complete!' : 'Chapter complete!'}</div>
      <div style="font-size:12px;color:#555;line-height:1.45;max-width:240px;font-style:italic">"${_esc(story.title)}"</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px">
        <button class="drd-end-btn sec" id="drdEndFull">📖 Read Full</button>
        <button class="drd-end-btn sec" id="drdEndShare">📤 Share</button>
        <button class="drd-end-btn sec" id="drdEndClose">✕ Close</button>
      </div>
    </div></div>`;

    const slidesEl = document.getElementById('drdSlides');
    slidesEl.innerHTML = html;
    slidesEl.scrollLeft = 0;

    document.getElementById('drdOv').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('drdTitleBlk').style.opacity = '0';
    document.getElementById('drdBottom').classList.remove('show');
    _lastChromeIdx = null;
    _chromeApplicable = false;
    clearTimeout(_chromeRevealTimer);

    _renderRxSlot(story);
    _syncHeaderMeta(story);
    _syncWalletUI();

    slidesEl.removeEventListener('scroll', _onScroll);
    slidesEl.addEventListener('scroll', _onScroll, { passive: true });
    _onScroll();

    setTimeout(() => {
      const synEl = document.getElementById('drdCovSyn');
      const synMore = document.getElementById('drdCovSeeMore');
      if (synEl && synMore) {
        if (synEl.scrollHeight <= synEl.clientHeight + 4) synMore.style.display = 'none';
        else synMore.addEventListener('click', () => {
          synEl.classList.toggle('expanded');
          synMore.textContent = synEl.classList.contains('expanded') ? 'See less ‹' : 'See more ›';
        });
      }
      document.getElementById('drdCovStart')?.addEventListener('click', () => _jmp('.drd-slide:nth-child(2)'));
      document.getElementById('drdCovFull')?.addEventListener('click', () => {
        if (typeof _hooks.onReadFull === 'function') _hooks.onReadFull(story);
        else location.href = 'bridge.html';
      });
      if (hasPoll) document.getElementById('drdPillPoll')?.addEventListener('click', () => _jmp('#drdPollSl'));
      if (hasDebate) document.getElementById('drdPillDebate')?.addEventListener('click', () => _jmp('#drdDebSl'));
      if (hasNext) document.getElementById('drdPillNext')?.addEventListener('click', () => _jmp('#drdNextSl'));
      if (opts.jumpTo === 'debate' && hasDebate) setTimeout(() => _jmp('#drdDebSl'), 100);
      if (opts.jumpTo === 'poll' && hasPoll) setTimeout(() => _jmp('#drdPollSl'), 100);

      document.getElementById('drdAdSkip')?.addEventListener('click', () => {
        slidesEl.scrollTo({ left: slidesEl.scrollLeft + slidesEl.offsetWidth, behavior: 'smooth' });
      });
      slidesEl.querySelectorAll('.drd-ad-cta').forEach(btn => {
        btn._drdBound = true;
        btn.addEventListener('click', () => { if (btn.dataset.adUrl) window.open(btn.dataset.adUrl, '_blank'); });
      });

      if (hasPoll) _bindPoll(story, eng);
      if (hasDebate) _bindDebate(story, eng);
      if (hasNext) {
        document.getElementById('drdNotifyBtn')?.addEventListener('click', () => {
          if (typeof _hooks.onNotifyNext === 'function') _hooks.onNotifyNext(story);
          _toast("🔔 You'll be notified!");
        });
        document.getElementById('drdNextShare')?.addEventListener('click', () => _shareStory(story));
      }

      document.getElementById('drdEndFull')?.addEventListener('click', () => {
        if (typeof _hooks.onReadFull === 'function') _hooks.onReadFull(story);
        else location.href = 'bridge.html';
      });
      document.getElementById('drdEndShare')?.addEventListener('click', () => _shareStory(story));
      document.getElementById('drdEndClose')?.addEventListener('click', close);
    }, 80);
  }

  function _bindPoll(story, eng) {
    document.querySelectorAll('#drdPollSl .drd-eng-opt').forEach(el => {
      el.addEventListener('click', () => {
        if (eng.poll.voted >= 0) return;
        const oi = +el.dataset.oi;
        eng.poll.opts[oi].v++;
        eng.poll.voted = oi;
        if (typeof _hooks.onPollVote === 'function') _hooks.onPollVote(story, oi);
        _toast('✅ Vote recorded!');
        document.querySelectorAll('#drdPollSl .drd-eng-opt').forEach((o, i) => o.classList.toggle('voted', i === oi));
        const tot = eng.poll.opts.reduce((s, o) => s + o.v, 0) || 1;
        document.querySelectorAll('#drdPollSl .drd-eng-opt').forEach((o, i) => {
          const pct = Math.round(eng.poll.opts[i].v / tot * 100);
          o.querySelector('.drd-eng-opt-bar').style.width = pct + '%';
          o.querySelector('.drd-eng-opt-pct').textContent = pct + '%';
        });
      });
    });
    document.getElementById('drdPollShare')?.addEventListener('click', () => _shareStory(story));
  }

  function _bindDebate(story, eng) {
    const d = eng.debate;
    document.querySelectorAll('#drdDebSl .drd-d-side').forEach(el => {
      el.addEventListener('click', () => {
        if (d.userVote) return;
        const side = el.dataset.side;
        d.userVote = side;
        if (side === 'for') d.forV++; else d.agV++;
        el.classList.add('chosen');
        const inp = document.getElementById('drdDebInp');
        if (inp) { inp.disabled = false; inp.placeholder = side === 'for' ? "You're FOR ✅ — make your case!" : "You're AGAINST ❌ — make your case!"; inp.focus(); }
        if (typeof _hooks.onDebateVote === 'function') _hooks.onDebateVote(story, side);
        _toast(side === 'for' ? "✅ You're FOR!" : "❌ You're AGAINST!");
        const tot = (d.forV + d.agV) || 1, fp = Math.round(d.forV / tot * 100);
        document.querySelectorAll('#drdDebSl .drd-d-side').forEach(s => {
          const sv = s.dataset.side, bar = s.querySelector('.drd-d-bar'), pct = s.querySelector('.drd-d-pct'), cnt = s.querySelector('.drd-d-cnt');
          const val = sv === 'for' ? fp : 100 - fp;
          if (bar) bar.style.width = val + '%';
          if (pct) pct.textContent = val + '%';
          if (cnt) cnt.textContent = _fmtN(sv === 'for' ? d.forV : d.agV) + ' readers';
        });
      });
    });
    document.getElementById('drdDebPost')?.addEventListener('click', () => {
      const inp = document.getElementById('drdDebInp');
      const text = inp ? inp.value.trim() : '';
      if (!text) { _toast('✍️ Write your argument first!'); return; }
      d.comments = d.comments || [];
      d.comments.push({ id: 'dc_' + Date.now(), name: 'You', avatar: null, text, side: d.userVote || 'for', time: 'Just now', likes: 0, liked: false });
      if (inp) inp.value = '';
      if (typeof _hooks.onDebateComment === 'function') _hooks.onDebateComment(story, text, d.userVote || 'for');
      _toast('💬 Argument posted!');
    });
    document.getElementById('drdDebShare')?.addEventListener('click', () => _shareStory(story));
    document.getElementById('drdDebOpen')?.addEventListener('click', () => { location.href = 'debate.html'; });
    const cmList = document.getElementById('drdDebCmList');
    cmList?.addEventListener('click', e => {
      const lb = e.target.closest('.drd-dcm-like');
      if (!lb) return;
      const c = (d.comments || []).find(x => String(x.id) === lb.dataset.cid);
      if (!c) return;
      c.liked = !c.liked; c.likes += c.liked ? 1 : -1;
      lb.classList.toggle('liked', c.liked);
      lb.innerHTML = `<i class="${c.liked ? 'fas' : 'far'} fa-heart"></i> ${c.likes}`;
    });
  }

  function _onScroll() {
    const slidesEl = document.getElementById('drdSlides');
    if (!slidesEl || !_curStory) return;
    const vw = slidesEl.offsetWidth;
    const total = Math.round(slidesEl.scrollWidth / vw);
    const idx = Math.round(slidesEl.scrollLeft / vw);
    const pct = total > 1 ? (idx / (total - 1)) * 100 : 0;
    document.getElementById('drdProg').style.width = pct + '%';

    // Bottom action bar: hidden on the cover slide, appears the moment the
    // first real slide (scene / locked-chapter / ad) comes into view, and
    // stays put from then on — it does not auto-hide like the title chrome.
    const bottomEl = document.getElementById('drdBottom');
    if (bottomEl) bottomEl.classList.toggle('show', idx >= 1);

    const currentSlide = slidesEl.children[idx];
    const chromeApplicable = _isChromeApplicableSlide(currentSlide);
    _chromeApplicable = chromeApplicable;

    if (idx !== _lastChromeIdx) {
      _lastChromeIdx = idx;
      clearTimeout(_chromeRevealTimer);
      _hideChromeNow(); // every new slide starts with chrome hidden; a tap toggles it
    }

    document.getElementById('drdStoryT').textContent = _curStory.title;
    document.getElementById('drdCh').textContent = _typeChBadge(_curStory);
    _hideSelPop();
  }

  function close() {
    document.getElementById('drdOv').classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('drdSlides').removeEventListener('scroll', _onScroll);
    clearTimeout(_chromeRevealTimer);
    _lastChromeIdx = null;
    if (window.__drdCleanSel) window.__drdCleanSel();
    _closeQuoteOv();
    closeComments();
    _curStory = null;
  }

  function _shareStory(story) {
    if (typeof window.openShareModal === 'function') {
      window.openShareModal({
        title: story.title,
        sub: `by @${(story.writer && story.writer.name) || 'writer'}`,
        img: story.cover,
        url: _quoteUrl(story),
      });
    } else {
      _toast('📤 Share link copied!');
    }
  }

  function _saveStory(story) {
    if (typeof window.openSaveModal === 'function') {
      window.openSaveModal({ title: story.title, sub: `by @${(story.writer && story.writer.name) || 'writer'}`, img: story.cover, storyId: story.id });
    } else {
      _toast('📌 Saved');
    }
  }

  function _tipWriter(story) {
    if (typeof window.DroboardTip !== 'undefined') {
      window.DroboardTip.open('story-' + story.id, story.writer || {});
    } else {
      _toast('💛 Tipping coming soon');
    }
  }

  function _bindStaticEvents() {
    document.getElementById('drdClose').addEventListener('click', close);
    document.getElementById('drdSynBtn').addEventListener('click', () => {
      document.getElementById('drdSlides').scrollTo({ left: 0, behavior: 'smooth' });
    });

    document.getElementById('drdCmtAct').addEventListener('click', () => { if (_curStory) openComments(_curStory); });
    document.getElementById('drdCmClose').addEventListener('click', closeComments);
    document.getElementById('drdCmBg').addEventListener('click', e => { if (e.target === e.currentTarget) closeComments(); });

    document.getElementById('drdSaveAct').addEventListener('click', () => { if (_curStory) _saveStory(_curStory); });
    document.getElementById('drdShareAct').addEventListener('click', () => { if (_curStory) _shareStory(_curStory); });
    document.getElementById('drdTipAct').addEventListener('click', () => { if (_curStory) _tipWriter(_curStory); });

    const prevSaveChange = window.onDroboardSaveChange;
    window.onDroboardSaveChange = function (storyId, saved) {
      if (typeof prevSaveChange === 'function') prevSaveChange(storyId, saved);
      if (_curStory && String(_curStory.id) === String(storyId)) {
        const el = document.getElementById('drdSaveAct');
        el.classList.toggle('saved', saved);
        el.querySelector('i').className = saved ? 'fas fa-bookmark' : 'far fa-bookmark';
      }
    };

    document.getElementById('drdSelShare').addEventListener('click', () => {
      const pop = document.getElementById('drdSelPop');
      const text = pop._t || window.getSelection()?.toString().trim() || '';
      _hideSelPop();
      if (text && selStory) _openQuoteOv(text, selStory);
      window.getSelection()?.removeAllRanges();
    });
    document.getElementById('drdSelSave').addEventListener('click', () => {
      _hideSelPop();
      window.getSelection()?.removeAllRanges();
      _toast('📌 Quote saved!');
    });
    document.getElementById('drdSelCopy').addEventListener('click', () => {
      const pop = document.getElementById('drdSelPop');
      navigator.clipboard?.writeText(pop._t || '').catch(() => {});
      _hideSelPop();
      window.getSelection()?.removeAllRanges();
      _toast('📋 Copied!');
    });
    document.addEventListener('mousedown', e => { if (!e.target.closest('.drd-sel-pop')) _hideSelPop(); }, { passive: true });
    document.addEventListener('touchstart', e => { if (!e.target.closest('.drd-sel-pop')) _hideSelPop(); }, { passive: true });

    document.getElementById('drdQClose').addEventListener('click', _closeQuoteOv);
    document.getElementById('drdQShare').addEventListener('click', () => {
      if (!qStory) return;
      if (typeof window.openShareModal === 'function') {
        window.openShareModal({
          title: qStory.title,
          sub: `"${qText}" — @${(qStory.writer && qStory.writer.name) || 'writer'}`,
          img: qStory.cover,
          url: _quoteUrl(qStory),
        });
      } else {
        _toast('📤 Share link copied!');
      }
      _closeQuoteOv();
    });
    document.getElementById('drdQCopy').addEventListener('click', () => {
      if (!qStory) return;
      const full = `"${qText}"\n\n— @${(qStory.writer && qStory.writer.name) || 'writer'}\n\nRead on Droboard: ${_quoteUrl(qStory)}`;
      navigator.clipboard?.writeText(full).catch(() => {});
      _toast('📋 Copied!');
    });

    // ── Chapter-level unlock clicks (bound once — slidesEl persists across opens) ──
    document.getElementById('drdSlides').addEventListener('click', e => {
      const chOpt = e.target.closest('[data-unlockchapter]');
      if (chOpt && _curStory) { e.stopPropagation(); _attemptUnlockChapter(_curStory, +chOpt.dataset.cost); return; }
    });

    // ── Tap-anywhere chrome toggle (bound once — slidesEl persists across opens) ──
    document.getElementById('drdSlides').addEventListener('click', e => {
      if (e.target.closest('[data-unlockchapter]')) return;
      if (_chromeApplicable) _toggleChrome();
    });

    // ── Wallet / paywall UI ──
    document.getElementById('drdBalBuyBtn').addEventListener('click', () => {
      _closeInsufficientBalance();
      _openBuyCoins(_pendingInsufficientRetry);
      _pendingInsufficientRetry = null;
    });
    document.getElementById('drdBalCancelBtn').addEventListener('click', () => {
      _closeInsufficientBalance();
      _pendingInsufficientRetry = null;
    });
    document.getElementById('drdBuyClose').addEventListener('click', _closeBuyCoins);
    document.getElementById('drdBuyOv').addEventListener('click', e => { if (e.target === e.currentTarget) _closeBuyCoins(); });
    document.querySelectorAll('.drd-buy-tab').forEach(t => t.addEventListener('click', () => _setBuyTab(t.dataset.tab)));
    document.getElementById('drdBuyPackages').addEventListener('click', e => {
      const el = e.target.closest('[data-pkgidx]');
      if (el) _buyPackage(+el.dataset.pkgidx);
    });
    document.getElementById('drdFundConfirm').addEventListener('click', _fundWallet);
  }

  function attach(hooks) {
    _hooks = hooks || {};
    _build();
  }

  window.DroboardReader = { attach, open, close };

})();