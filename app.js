const CART_KEY='ukmaxx_cart_v1';
const PROMO_KEY='ukmaxx_promo_v1';
const money=n=>`£${Number(n).toFixed(2)}`;
const sanitizeCart=(arr=[])=>{
  const map=new Map();
  (Array.isArray(arr)?arr:[]).forEach(i=>{
    const sku=normalizeSku(i?.sku||'');
    const qty=Math.max(0,Number(i?.qty||0));
    if(!sku||!PRODUCTS[sku]||!qty) return;
    map.set(sku,(map.get(sku)||0)+qty);
  });
  return [...map.entries()].map(([sku,qty])=>({sku,qty}));
};
const getCart=()=>sanitizeCart(JSON.parse(localStorage.getItem(CART_KEY)||'[]'));
const setCart=c=>localStorage.setItem(CART_KEY,JSON.stringify(sanitizeCart(c)));
const STRIPE_PUBLISHABLE_KEY='STRIPE_PUBLISHABLE_KEY';
const normalizeSku=(raw='')=>{
  const t=String(raw).trim();
  const key=t.split('-')[0].split('-')[0].trim();
  if(key.toUpperCase().startsWith('RT10 X3')||key.toUpperCase().startsWith('RT10X3')) return 'RT10X3';
  if(key.toUpperCase().startsWith('RT10')) return 'RT10';
  if(key.toUpperCase().startsWith('BC5')) return 'BC5';
  if(key.toUpperCase().startsWith('IP5')) return 'IP5';
  if(key.toUpperCase().startsWith('NJ500')) return 'NJ500';
  if(key.toUpperCase().startsWith('WA10')) return 'WA10';
  return key;
};

function renderCart(){
  const countEl=document.getElementById('cartCount');
  const itemsEl=document.getElementById('cartItems');
  const totalsEl=document.getElementById('cartTotals');
  const summaryEl=document.getElementById('checkoutSummary');
  const c=getCart();
  if(countEl) countEl.textContent=String(c.reduce((a,b)=>a+b.qty,0));
  if(!itemsEl||!totalsEl||!summaryEl) return;
  if(!c.length){ itemsEl.innerHTML=`<div class='cart-empty'><div class='cart-empty-icon' aria-hidden='true'><svg viewBox='0 0 24 24' width='28' height='28' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='9' cy='20' r='1'></circle><circle cx='18' cy='20' r='1'></circle><path d='M2 3h3l2.4 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 7H6'></path></svg></div><div class='cart-empty-title'>YOUR BASKET IS EMPTY</div><div class='cart-empty-body'>Add products to your basket to begin secure checkout.</div></div>`; totalsEl.textContent=''; summaryEl.textContent=''; if(checkoutBtn){checkoutBtn.disabled=true; checkoutBtn.textContent='ADD ITEMS TO CHECKOUT';} return; }
  const normalized=c.map(i=>({sku:normalizeSku(i.sku),qty:i.qty})).filter(i=>PRODUCTS[i.sku]);
  if(!normalized.length){ itemsEl.innerHTML=`<div class='cart-empty'><div class='cart-empty-icon' aria-hidden='true'><svg viewBox='0 0 24 24' width='28' height='28' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='9' cy='20' r='1'></circle><circle cx='18' cy='20' r='1'></circle><path d='M2 3h3l2.4 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 7H6'></path></svg></div><div class='cart-empty-title'>YOUR BASKET IS EMPTY</div><div class='cart-empty-body'>Add products to your basket to begin secure checkout.</div></div>`; totalsEl.textContent=''; summaryEl.textContent=''; if(checkoutBtn){checkoutBtn.disabled=true; checkoutBtn.textContent='ADD ITEMS TO CHECKOUT';} return; }
  itemsEl.innerHTML=normalized.map(i=>`<div class='cart-item'><div class='cart-item-row'><img class='cart-thumb' src='${PRODUCTS[i.sku].image}' alt='${PRODUCTS[i.sku].name}'><div style='min-width:0;flex:1'><div><strong>${PRODUCTS[i.sku]?.name||i.sku}</strong></div><div style='margin-top:4px'>${money(PRODUCTS[i.sku].price)} x ${i.qty}</div><div class='qty'><button aria-label='Decrease quantity' data-a='dec' data-sku='${i.sku}'>-</button><button aria-label='Increase quantity' data-a='inc' data-sku='${i.sku}'>+</button><button aria-label='Remove item' style='margin-left:auto;padding:8px 10px;min-height:36px' data-a='rm' data-sku='${i.sku}'>Remove</button></div></div></div></div>`).join(''); if(checkoutBtn){checkoutBtn.disabled=false; checkoutBtn.textContent='CHECKOUT';}
  const peptideSkus=['RT10','BC5','IP5','NJ500'];
  const hasPeptide=normalized.some(i=>peptideSkus.includes(i.sku));
  const hasBac=normalized.some(i=>i.sku==='WA10');
  if(hasPeptide && !hasBac){itemsEl.innerHTML += `<div style='padding:12px 0'><div style='font-family:"Share Tech Mono",monospace;font-size:10px;color:var(--dim);margin-bottom:6px'>You may also need</div><div class='cart-item-row'><img class='cart-thumb' src='${PRODUCTS.WA10.image}' alt='BAC Water'><div style='flex:1'><div><strong>BAC WATER</strong></div><div style='margin-top:4px'>${money(PRODUCTS.WA10.price)}</div><button class='add-btn' id='upsellBacBtn' style='margin-top:8px;min-height:36px'>ADD</button></div></div></div>`;}
  const sub=normalized.reduce((a,b)=>a+PRODUCTS[b.sku].price*b.qty,0);
  const promo=(localStorage.getItem(PROMO_KEY)||'').toUpperCase();
  const discountRate=promo==='MAXX15'?0.15:0;
  const discount=sub*discountRate;
  const ship=(sub-discount)>=100||sub===0?0:4.99;
  const tot=sub-discount+ship;
  totalsEl.innerHTML=`Subtotal ${money(sub)}${discountRate?`<br>Discount (${promo}) -${money(discount)}`:''}<br>Shipping ${ship===0?'FREE':money(ship)}<br><strong>Total ${money(tot)}</strong>`;
  summaryEl.innerHTML=`<div style='display:flex;justify-content:space-between'><span>Subtotal:</span><strong>${money(sub)}</strong></div>${discountRate?`<div style='display:flex;justify-content:space-between'><span>Discount (${promo}):</span><strong>-${money(discount)}</strong></div>`:''}<div style='display:flex;justify-content:space-between'><span>Shipping:</span><strong>${ship===0?'FREE':money(ship)}</strong></div><div style='border-top:1px solid var(--border);margin:8px 0'></div><div style='display:flex;justify-content:space-between'><span>Total:</span><strong>${money(tot)}</strong></div>`;
}
function addSku(s){const c=getCart();const f=c.find(x=>x.sku===s); if(f) f.qty++; else c.push({sku:s,qty:1}); setCart(c); renderCart();}
function chg(s,d){const c=getCart(); const f=c.find(x=>x.sku===s); if(!f) return; f.qty+=d; if(f.qty<=0)c.splice(c.indexOf(f),1); setCart(c); renderCart();}
function rmv(s){setCart(getCart().filter(x=>x.sku!==s)); renderCart();}

function orderRef(){ return `UKM-${Math.random().toString(36).slice(2,7).toUpperCase()}`; }

async function startCheckout(){
  const email=document.getElementById('email')?.value.trim();
  const fullName=document.getElementById('fullName')?.value.trim();
  const address=document.getElementById('address')?.value.trim();
  const address2=document.getElementById('address2')?.value.trim();
  const city=document.getElementById('city')?.value.trim();
  const postcode=document.getElementById('postcode')?.value.trim();
  const country=document.getElementById('country')?.value;
  const err=document.getElementById('checkoutError');
  const payBtn=document.getElementById('payBtn');
  if(err){ err.style.display='none'; err.textContent=''; }
  if(!email||!fullName||!address||!city||!postcode||!country){ if(err){err.textContent='Please complete all required address fields before payment.';err.style.display='block';} return; }
  const c=getCart(); if(!c.length){ if(err){err.textContent='Your basket is empty.';err.style.display='block';} return; }

  const promoOptIn=!!document.getElementById('promoOptIn')?.checked;
  const promoCode=(localStorage.getItem(PROMO_KEY)||'').toUpperCase();

  try{
    if(payBtn){ payBtn.disabled=true; payBtn.textContent='PROCESSING...'; }
    const controller=new AbortController();
    const to=setTimeout(()=>controller.abort(),12000);
    const res=await fetch('/api/create-checkout-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cartItems:c,email,fullName,promoOptIn,promoCode,address:{line1:address,line2:address2,city,postal_code:postcode,country}}),signal:controller.signal});
    clearTimeout(to);
    const raw=await res.text();
    let data={}; try{ data=JSON.parse(raw); }catch{ data={}; }
    if(!res.ok||!data.url){ if(err){err.textContent=(data.error||'Unable to start payment. Please check Stripe env vars and retry.');err.style.display='block';} return; }
    window.location.href=data.url;
  }catch(e){
    if(err){ err.textContent=e?.name==='AbortError'?'Payment request timed out. Please try again.':'Unable to start payment. Network/API error.'; err.style.display='block'; }
  }finally{
    if(payBtn){ payBtn.disabled=false; payBtn.textContent='CONTINUE TO PAYMENT'; }
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const ageGate=document.getElementById('ageGate');
  const ageVerified=localStorage.getItem('ukmaxx_age_verified')==='true';
  if(ageGate && !ageVerified){
    document.body.classList.add('age-gate-lock');
    ageGate.classList.add('show');
    const enterBtn=document.getElementById('ageEnterBtn');
    const exitBtn=document.getElementById('ageExitBtn');
    enterBtn?.addEventListener('click',()=>{localStorage.setItem('ukmaxx_age_verified','true');ageGate.classList.remove('show');document.body.classList.remove('age-gate-lock');document.body.classList.remove('pre-gate');});
    exitBtn?.addEventListener('click',()=>{window.location.href='/access-denied.html';});
  } else {
    document.body.classList.remove('pre-gate');
  }

  const params=new URLSearchParams(location.search);
  const success=params.get('payment')==='success';
  const cancelled=params.get('payment')==='cancelled';

  document.querySelectorAll('#products .product-card .add-btn, #bundles .product-card .add-btn').forEach(b=>b.addEventListener('click',(e)=>{
    e.stopPropagation();
    const sku=normalizeSku((b.closest('.product-body')?.querySelector('.product-sku')?.textContent||'')); if(sku) addSku(sku);
  }));

  const detailData={
    RT10:{science:'Retatrutide is a triple agonist peptide targeting GLP-1, GIP, and glucagon receptors simultaneously. Research focus areas include metabolic regulation, adipose tissue reduction, and energy homeostasis. Currently in Phase 2/3 clinical trials.',specs:'Form: Lyophilised peptide\nDose: 10mg per vial\nPurity: 99.8% (UPLC/MS verified)\nStorage: -20°C (unopened) / 4°C (reconstituted, use within 28 days)\nReconstitution: Add 2ml bacteriostatic water slowly down vial wall. Swirl gently - do not shake. Allow 5 minutes to dissolve fully.\nShelf life: 24 months unopened',coa:'Lab: Brown Biology / Janoshik Analytical\nBatch: RT10-2026-05-A\nMethod: UPLC/MS\nDate: May 2026\nPurity: 99.8%'},
    BC5:{science:'BPC-157 (Body Protection Compound 157) is a synthetic pentadecapeptide derived from a human gastric protein. Research applications include wound healing mechanisms, angiogenesis, and musculoskeletal tissue repair models. Studied extensively in rodent models.',specs:'Form: Lyophilised peptide\nDose: 5mg per vial\nPurity: 99%+ (HPLC verified)\nStorage: -20°C (unopened) / 4°C (reconstituted, use within 28 days)\nReconstitution: Add 2ml bacteriostatic water slowly. Swirl gently.\nShelf life: 24 months unopened',coa:'Lab: Janoshik Analytical\nBatch: BPC157-2026-05-A\nMethod: HPLC\nDate: May 2026\nPurity: 99%+'},
    IP5:{science:'Ipamorelin is a selective growth hormone secretagogue and ghrelin receptor agonist. Research focus includes GH pulse stimulation, IGF-1 pathway modulation, and metabolic signalling. Notable for high selectivity with minimal cortisol or prolactin interference in research models.',specs:'Form: Lyophilised peptide\nDose: 5mg per vial\nPurity: 99%+ (mass spectrometry verified)\nStorage: -20°C (unopened) / 4°C (reconstituted, use within 28 days)\nReconstitution: Add 2ml bacteriostatic water slowly. Swirl gently.\nShelf life: 24 months unopened',coa:'Lab: Janoshik Analytical\nBatch: IPA-2026-05-A\nMethod: MS\nDate: May 2026\nPurity: 99%+'},
    NJ500:{science:'Nicotinamide adenine dinucleotide (NAD+) is a coenzyme central to cellular energy metabolism and redox reactions. Research applications include mitochondrial function studies, sirtuin pathway activation, and DNA repair mechanism research.',specs:'Form: Lyophilised powder\nDose: 500mg per vial\nPurity: 99%+ (identity verified)\nStorage: -20°C (unopened) / 4°C (reconstituted, use within 7 days)\nReconstitution: Add sterile water or BAC water. Dissolve fully before use. Do not shake.\nShelf life: 24 months unopened',coa:'Lab: Janoshik Analytical\nBatch: NJ500-2026-05-A\nMethod: Identity verification\nDate: May 2026\nPurity: 99%+'},
    WA10:{science:'Bacteriostatic water is sterile water containing 0.9% benzyl alcohol, which inhibits bacterial growth. Used as a reconstitution solvent for lyophilised peptide compounds in laboratory settings. Multi-draw safe due to bacteriostatic properties.',specs:'Form: Sterile aqueous solution\nVolume: 10ml per vial\nComposition: 0.9% benzyl alcohol in water for injection\nStorage: Room temperature (unopened) / 4°C (opened)\nShelf life: 24 months unopened / 28 days opened\nNote: For laboratory reconstitution use only',coa:'Standard: Sterility confirmed\nBatch: BW-2026-05-A'}
  };

  const cards=[...document.querySelectorAll('#products .product-card')];
  cards.forEach(card=>{
    const sku=((card.querySelector('.product-sku')?.textContent||'').split('-')[0]||'').trim();
    const d=detailData[sku];
    if(!d) return;
    const panel=document.createElement('div'); panel.className='expand-panel';
    const specsRows=d.specs.split('\n').map(line=>{const i=line.indexOf(':'); if(i<0) return ''; return `<dt>${line.slice(0,i)}</dt><dd>${line.slice(i+1).trim()}</dd>`;}).join('');
    const coaRows=d.coa.split('\n').map(line=>{const i=line.indexOf(':'); if(i<0) return ''; return `<dt>${line.slice(0,i)}</dt><dd>${line.slice(i+1).trim()}</dd>`;}).join('');
    const needsBac=['RT10','BC5','IP5','NJ500'].includes(sku);
    const showBacBtn=needsBac && !getCart().some(i=>i.sku==='WA10');
    panel.innerHTML=`<div class='tabs'><button class='tab-btn active' data-tab='science'>SCIENCE</button><button class='tab-btn' data-tab='specs'>SPECS</button><button class='tab-btn' data-tab='coa'>COA</button></div><div class='tab-pane science active' data-pane='science'>${d.science}</div><div class='tab-pane' data-pane='specs'><dl class='dl'>${specsRows}</dl>${needsBac?`<div class='info-box'>Reconstitution requires bacteriostatic water. ${showBacBtn?`<button class='add-btn' data-bac style='min-height:30px;padding:4px 10px;margin-left:6px'>ADD BAC WATER</button>`:''}</div>`:''}</div><div class='tab-pane' data-pane='coa'><dl class='dl'>${coaRows}</dl><a href='#' class='coa-trigger' style='color:var(--accent);text-decoration:none'>View Details & COA</a></div>`;
    card.querySelector('.product-body')?.appendChild(panel);

    card.addEventListener('click',(e)=>{if(e.target.closest('.add-btn')) return; if(e.target.closest('.coa-trigger')) e.preventDefault(); const isOpen=card.classList.contains('expanded'); cards.forEach(c=>c.classList.remove('expanded')); if(!isOpen) card.classList.add('expanded');});
    panel.querySelectorAll('.tab-btn').forEach(tb=>tb.addEventListener('click',(e)=>{e.stopPropagation(); panel.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active')); panel.querySelectorAll('.tab-pane').forEach(x=>x.classList.remove('active')); tb.classList.add('active'); panel.querySelector(`[data-pane='${tb.dataset.tab}']`)?.classList.add('active');}));
    panel.querySelector('[data-bac]')?.addEventListener('click',(e)=>{e.stopPropagation(); if(!getCart().some(i=>i.sku==='WA10')) addSku('WA10'); });
  });
  document.getElementById('shopNowBtn')?.addEventListener('click',()=>document.querySelector('#products')?.scrollIntoView({behavior:'smooth'}));
  const drawer=document.getElementById('cartDrawer');
  const cartFab=document.getElementById('cartFab');
  cartFab?.addEventListener('click',()=>drawer?.classList.add('open'));
  document.getElementById('cartClose')?.addEventListener('click',()=>drawer?.classList.remove('open'));
  let scrollTimer; window.addEventListener('scroll',()=>{ if(!cartFab) return; cartFab.classList.add('scrolling'); clearTimeout(scrollTimer); scrollTimer=setTimeout(()=>cartFab.classList.remove('scrolling'),300); },{passive:true});
  document.getElementById('checkoutBtn')?.addEventListener('click',()=>document.getElementById('checkoutModal')?.classList.add('open'));
  document.getElementById('checkoutClose')?.addEventListener('click',()=>document.getElementById('checkoutModal')?.classList.remove('open'));
  const payBtnEl=document.getElementById('payBtn');
  if(payBtnEl){ payBtnEl.addEventListener('click',startCheckout); payBtnEl.onclick=startCheckout; }
  document.getElementById('applyPromoBtn')?.addEventListener('click',()=>{
    const input=document.getElementById('promoCode'); const msg=document.getElementById('promoMsg');
    const code=(input?.value||'').trim().toUpperCase();
    if(code==='MAXX15'){ localStorage.setItem(PROMO_KEY,'MAXX15'); if(msg){msg.textContent='MAXX15 applied - 15% off compounds.'; msg.style.color='var(--accent)';} }
    else { localStorage.removeItem(PROMO_KEY); if(msg){msg.textContent=code?'Invalid promo code.':'Promo removed.'; msg.style.color='var(--dim)';} }
    renderCart();
  });


  document.getElementById('cartItems')?.addEventListener('click',(e)=>{const t=e.target; if(!(t instanceof HTMLElement)) return; if(t.id==='upsellBacBtn'){ addSku('WA10'); return; } const sku=t.getAttribute('data-sku'); const a=t.getAttribute('data-a'); if(!sku||!a) return; if(a==='inc') chg(sku,1); if(a==='dec') chg(sku,-1); if(a==='rm') rmv(sku);});
  document.getElementById('notifyBtn')?.addEventListener('click',()=>{const em=document.getElementById('notifyEmail')?.value.trim(); if(!em) return; const list=JSON.parse(localStorage.getItem('ukmaxx_notify_list')||'[]'); list.push({email:em,ts:Date.now()}); localStorage.setItem('ukmaxx_notify_list',JSON.stringify(list)); console.log('UKMAXX notify signup saved:',em); document.getElementById('notifyEmail').value='';});

  const reviewDrawer=document.getElementById('reviewDrawer');
  document.getElementById('leaveReviewBtn')?.addEventListener('click',(e)=>{e.preventDefault(); if(reviewDrawer) reviewDrawer.style.display='flex';});
  document.getElementById('reviewCloseBtn')?.addEventListener('click',()=>{ if(reviewDrawer) reviewDrawer.style.display='none'; });
  reviewDrawer?.addEventListener('click',(e)=>{ if(e.target===reviewDrawer) reviewDrawer.style.display='none'; });
  document.getElementById('reviewSubmitBtn')?.addEventListener('click',async ()=>{
    const name=document.getElementById('reviewName')?.value.trim();
    const product=document.getElementById('reviewProduct')?.value;
    const rating=document.getElementById('reviewRating')?.value;
    const text=document.getElementById('reviewText')?.value.trim();
    const msg=document.getElementById('reviewMsg');
    if(!name||!product||!rating||!text){ if(msg){msg.textContent='Please complete all review fields.'; msg.style.color='#b42318';} return; }

    try{
      const res=await fetch('/api/submit-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initials:name,product,rating:Number(rating),reviewText:text,hp:''})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok){ if(msg){msg.textContent='Unable to submit review right now.'; msg.style.color='#b42318';} return; }
      if(msg){msg.textContent='Thanks — your review was submitted for verification.'; msg.style.color='var(--accent)';}
      ['reviewName','reviewProduct','reviewRating','reviewText'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
    }catch{
      if(msg){msg.textContent='Network error — please try again.'; msg.style.color='#b42318';}
    }
  });

  const reviewsRail=document.getElementById('reviewsRail');
  const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
  const fmtDate=(iso)=>{try{return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}).toUpperCase();}catch{return '';}};
  if(reviewsRail){
    fetch('/api/reviews').then(r=>r.json()).then(data=>{
      const rows=Array.isArray(data?.reviews)?data.reviews:[];
      if(!rows.length) return;
      reviewsRail.innerHTML=rows.map(r=>`<article style="scroll-snap-align:start;flex:0 0 86%;border:1px solid var(--border);background:var(--white);padding:12px;min-height:168px"><div style="display:flex;justify-content:space-between;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--dim);text-transform:uppercase"><span>${r.product}</span><span>${fmtDate(r.review_date)}</span></div><div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.08em">${stars(Number(r.rating)||5)}</div><div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--accent);text-transform:uppercase;margin:5px 0">Verified Purchase</div><p style="font-size:13px;line-height:1.6">${r.review_text}</p><div style="margin-top:6px;font-size:12px;color:var(--dim)">— ${r.initials}</div></article>`).join('');
    }).catch(()=>{});
  }

  const lb=document.getElementById('coaLightbox'), lbImg=document.getElementById('lbImg'), lbTitle=document.getElementById('lbTitle'), lbBody=document.getElementById('lbBody');
  const lbData=[
    {sel:'.coa-micro:nth-child(1)',title:'TAMPER SEAL INTEGRITY',body:'Each vial ships with a tamper-evident security seal applied before dispatch. If the seal is broken, missing, or shows signs of interference on arrival, do not use the product. Contact us immediately at the address in the footer for a replacement.'},
    {sel:'.coa-micro:nth-child(2)',title:'BATCH CODE TRACEABILITY',body:'Every UKMAXX vial carries a unique batch QR code printed on the label. Scanning the code takes you directly to the third-party COA results for that specific batch - confirming compound identity, purity percentage, test method, lab name, and report date. This links the physical vial in your lab directly to its verified test data.'}
  ];
  const openLb=(src,title,body)=>{ if(!lb||!lbImg||!lbTitle||!lbBody) return; lbImg.src=src; lbTitle.textContent=title; lbBody.textContent=body; lb.classList.add('show'); requestAnimationFrame(()=>lb.classList.add('in')); lb.setAttribute('aria-hidden','false'); };
  const closeLb=()=>{ if(!lb) return; lb.classList.remove('in'); setTimeout(()=>lb.classList.remove('show'),250); lb.setAttribute('aria-hidden','true'); };
  lbData.forEach(d=>{ const el=document.querySelector(d.sel); const img=el?.querySelector('img'); if(el&&img){ el.addEventListener('click',()=>openLb(img.src,d.title,d.body)); }});
  document.getElementById('lbClose')?.addEventListener('click',closeLb);
  document.getElementById('lbClose2')?.addEventListener('click',closeLb);
  lb?.addEventListener('click',(e)=>{ if(e.target===lb) closeLb(); });

  if(success){
    setCart([]); renderCart();
    const sm=document.getElementById('successModal'); const ref=document.getElementById('orderRef'); if(ref) ref.textContent=`Order Reference: ${orderRef()}`; if(sm) sm.style.display='flex';
    document.getElementById('backToShop')?.addEventListener('click',()=>{ if(sm) sm.style.display='none'; history.replaceState({},'',location.pathname); window.scrollTo({top:0,behavior:'smooth'}); });
  }
  if(cancelled){
    const banner=document.getElementById('checkoutBanner'); if(banner){banner.style.display='block'; banner.textContent='Payment cancelled - your basket has been saved';}
    drawer?.classList.add('open');
    history.replaceState({},'',location.pathname);
  }

  renderCart();
});

