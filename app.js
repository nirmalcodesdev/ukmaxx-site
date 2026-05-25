const CART_KEY='ukmaxx_cart_v1';
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
  const key=t.split('—')[0].split('-')[0].trim();
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
  if(!c.length){ itemsEl.innerHTML='<p style="color:var(--dim)">Basket empty.</p>'; totalsEl.textContent=''; summaryEl.textContent=''; return; }
  const normalized=c.map(i=>({sku:normalizeSku(i.sku),qty:i.qty})).filter(i=>PRODUCTS[i.sku]);
  if(!normalized.length){ itemsEl.innerHTML='<p style="color:var(--dim)">Basket empty.</p>'; totalsEl.textContent=''; summaryEl.textContent=''; return; }
  itemsEl.innerHTML=normalized.map(i=>`<div class='cart-item'><div class='cart-item-row'><img class='cart-thumb' src='${PRODUCTS[i.sku].image}' alt='${PRODUCTS[i.sku].name}'><div style='min-width:0;flex:1'><div><strong>${PRODUCTS[i.sku]?.name||i.sku}</strong></div><div style='margin-top:4px'>${money(PRODUCTS[i.sku].price)} x ${i.qty}</div><div class='qty'><button aria-label='Decrease quantity' data-a='dec' data-sku='${i.sku}'>-</button><button aria-label='Increase quantity' data-a='inc' data-sku='${i.sku}'>+</button><button aria-label='Remove item' style='margin-left:auto;padding:8px 10px;min-height:36px' data-a='rm' data-sku='${i.sku}'>Remove</button></div></div></div></div>`).join('');
  const peptideSkus=['RT10','BC5','IP5','NJ500'];
  const hasPeptide=normalized.some(i=>peptideSkus.includes(i.sku));
  const hasBac=normalized.some(i=>i.sku==='WA10');
  if(hasPeptide && !hasBac){itemsEl.innerHTML += `<div style='padding:12px 0'><div style='font-family:"Share Tech Mono",monospace;font-size:10px;color:var(--dim);margin-bottom:6px'>You may also need</div><div class='cart-item-row'><img class='cart-thumb' src='${PRODUCTS.WA10.image}' alt='BAC Water'><div style='flex:1'><div><strong>BAC WATER</strong></div><div style='margin-top:4px'>${money(PRODUCTS.WA10.price)}</div><button class='add-btn' id='upsellBacBtn' style='margin-top:8px;min-height:36px'>ADD</button></div></div></div>`;}
  const sub=normalized.reduce((a,b)=>a+PRODUCTS[b.sku].price*b.qty,0), ship=sub?4.99:0, tot=sub+ship;
  totalsEl.innerHTML=`Subtotal ${money(sub)}<br>Shipping ${money(ship)}<br><strong>Total ${money(tot)}</strong>`;
  summaryEl.innerHTML=`<div style='display:flex;justify-content:space-between'><span>Subtotal:</span><strong>${money(sub)}</strong></div><div style='display:flex;justify-content:space-between'><span>Shipping:</span><strong>${money(ship)}</strong></div><div style='border-top:1px solid var(--border);margin:8px 0'></div><div style='display:flex;justify-content:space-between'><span>Total:</span><strong>${money(tot)}</strong></div>`;
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

  const items=c.map(i=>({
    price_data:{
      currency:'gbp',
      product_data:{ name:`${i.sku} x1` },
      unit_amount: Math.round(PRODUCTS[i.sku].price*100)
    },
    quantity:i.qty
  }));
  items.push({
    price_data:{currency:'gbp',product_data:{name:'UK TRACKED SHIPPING'},unit_amount:499},
    quantity:1
  });

  try{
    if(payBtn){ payBtn.disabled=true; payBtn.textContent='PROCESSING...'; }
    const controller=new AbortController();
    const to=setTimeout(()=>controller.abort(),12000);
    const res=await fetch('/api/create-checkout-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,customerEmail:email,customerName:fullName,address:{line1:address,line2:address2,city,postal_code:postcode,country}}),signal:controller.signal});
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
  const params=new URLSearchParams(location.search);
  const success=params.get('payment')==='success';
  const cancelled=params.get('payment')==='cancelled';

  const revealTargets=[
    '.hero > div:first-child','.hero-img-mosaic','.trust-item','.lab-banner-text','.section-header',
    '#products .product-card','#pens-coming-soon','.coa-section > div','.coa-img','.footer-brand','.footer-col'
  ];
  const revealEls=revealTargets.flatMap(sel=>[...document.querySelectorAll(sel)]);
  revealEls.forEach((el,i)=>{el.classList.add('reveal','reveal-stagger');el.style.setProperty('--delay',`${Math.min(i*70,420)}ms`);});
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in');io.unobserve(entry.target);}});
    },{threshold:0.12,rootMargin:'0px 0px -8% 0px'});
    revealEls.forEach(el=>io.observe(el));
  }else{ revealEls.forEach(el=>el.classList.add('in')); }

  document.querySelectorAll('#products .product-card .add-btn').forEach(b=>b.addEventListener('click',(e)=>{
    e.stopPropagation();
    const sku=normalizeSku((b.closest('.product-body')?.querySelector('.product-sku')?.textContent||'')); if(sku) addSku(sku);
  }));

  const detailData={
    RT10:{science:'Retatrutide is a triple agonist peptide targeting GLP-1, GIP, and glucagon receptors simultaneously. Research focus areas include metabolic regulation, adipose tissue reduction, and energy homeostasis. Currently in Phase 2/3 clinical trials.',specs:'Form: Lyophilised peptide\nDose: 10mg per vial\nPurity: 99.8% (UPLC/MS verified)\nStorage: -20°C (unopened) / 4°C (reconstituted, use within 28 days)\nReconstitution: Add 2ml bacteriostatic water slowly down vial wall. Swirl gently — do not shake. Allow 5 minutes to dissolve fully.\nShelf life: 24 months unopened',coa:'Lab: Brown Biology / Janoshik Analytical\nBatch: RT10-2026-05-A\nMethod: UPLC/MS\nDate: May 2026\nPurity: 99.8%'},
    BC5:{science:'BPC-157 (Body Protection Compound 157) is a synthetic pentadecapeptide derived from a human gastric protein. Research applications include wound healing mechanisms, angiogenesis, and musculoskeletal tissue repair models. Studied extensively in rodent models.',specs:'Form: Lyophilised peptide\nDose: 5mg per vial\nPurity: 99%+ (HPLC verified)\nStorage: -20°C (unopened) / 4°C (reconstituted, use within 28 days)\nReconstitution: Add 2ml bacteriostatic water slowly. Swirl gently.\nShelf life: 24 months unopened',coa:'Lab: Janoshik Analytical\nBatch: BPC157-2026-05-A\nMethod: HPLC\nDate: May 2026\nPurity: 99%+'},
    IP5:{science:'Ipamorelin is a selective growth hormone secretagogue and ghrelin receptor agonist. Research focus includes GH pulse stimulation, IGF-1 pathway modulation, and metabolic signalling. Notable for high selectivity with minimal cortisol or prolactin interference in research models.',specs:'Form: Lyophilised peptide\nDose: 5mg per vial\nPurity: 99%+ (mass spectrometry verified)\nStorage: -20°C (unopened) / 4°C (reconstituted, use within 28 days)\nReconstitution: Add 2ml bacteriostatic water slowly. Swirl gently.\nShelf life: 24 months unopened',coa:'Lab: Janoshik Analytical\nBatch: IPA-2026-05-A\nMethod: MS\nDate: May 2026\nPurity: 99%+'},
    NJ500:{science:'Nicotinamide adenine dinucleotide (NAD+) is a coenzyme central to cellular energy metabolism and redox reactions. Research applications include mitochondrial function studies, sirtuin pathway activation, and DNA repair mechanism research.',specs:'Form: Lyophilised powder\nDose: 500mg per vial\nPurity: 99%+ (identity verified)\nStorage: -20°C (unopened) / 4°C (reconstituted, use within 7 days)\nReconstitution: Add sterile water or BAC water. Dissolve fully before use. Do not shake.\nShelf life: 24 months unopened',coa:'Lab: Janoshik Analytical\nBatch: NJ500-2026-05-A\nMethod: Identity verification\nDate: May 2026\nPurity: 99%+'},
    WA10:{science:'Bacteriostatic water is sterile water containing 0.9% benzyl alcohol, which inhibits bacterial growth. Used as a reconstitution solvent for lyophilised peptide compounds in laboratory settings. Multi-draw safe due to bacteriostatic properties.',specs:'Form: Sterile aqueous solution\nVolume: 10ml per vial\nComposition: 0.9% benzyl alcohol in water for injection\nStorage: Room temperature (unopened) / 4°C (opened)\nShelf life: 24 months unopened / 28 days opened\nNote: For laboratory reconstitution use only',coa:'Standard: Sterility confirmed\nBatch: BW-2026-05-A'}
  };

  const cards=[...document.querySelectorAll('#products .product-card')];
  cards.forEach(card=>{
    const sku=((card.querySelector('.product-sku')?.textContent||'').split('—')[0]||'').trim();
    const d=detailData[sku];
    if(!d) return;
    const panel=document.createElement('div'); panel.className='expand-panel';
    const specsRows=d.specs.split('\n').map(line=>{const i=line.indexOf(':'); if(i<0) return ''; return `<dt>${line.slice(0,i)}</dt><dd>${line.slice(i+1).trim()}</dd>`;}).join('');
    const coaRows=d.coa.split('\n').map(line=>{const i=line.indexOf(':'); if(i<0) return ''; return `<dt>${line.slice(0,i)}</dt><dd>${line.slice(i+1).trim()}</dd>`;}).join('');
    const needsBac=['RT10','BC5','IP5','NJ500'].includes(sku);
    const showBacBtn=needsBac && !getCart().some(i=>i.sku==='WA10');
    panel.innerHTML=`<div class='tabs'><button class='tab-btn active' data-tab='science'>SCIENCE</button><button class='tab-btn' data-tab='specs'>SPECS</button><button class='tab-btn' data-tab='coa'>COA</button></div><div class='tab-pane science active' data-pane='science'>${d.science}</div><div class='tab-pane' data-pane='specs'><dl class='dl'>${specsRows}</dl>${needsBac?`<div class='info-box'>Reconstitution requires bacteriostatic water. ${showBacBtn?`<button class='add-btn' data-bac style='min-height:30px;padding:4px 10px;margin-left:6px'>ADD BAC WATER</button>`:''}</div>`:''}</div><div class='tab-pane' data-pane='coa'><dl class='dl'>${coaRows}</dl><a href='#coa' style='color:var(--accent);text-decoration:none'>View Full COA Report →</a></div>`;
    card.querySelector('.product-body')?.appendChild(panel);

    card.addEventListener('click',(e)=>{if(e.target.closest('.add-btn')) return; const isOpen=card.classList.contains('expanded'); cards.forEach(c=>c.classList.remove('expanded')); if(!isOpen) card.classList.add('expanded');});
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

  const coaBody=document.querySelector('.coa-body');
  if(coaBody){
    coaBody.insertAdjacentHTML('beforeend',`<div class='coa-tool'><input id='batchLookup' placeholder='Enter Batch ID (e.g. RT10-2026-05-A)' style='width:100%;padding:12px;min-height:44px;border:1px solid var(--border)'><button id='lookupBtn' class='add-btn' style='margin-top:8px;min-height:44px;width:100%'>VERIFY BATCH</button><div id='lookupOut' class='coa-result-box' style='display:none'></div></div>`);
    document.getElementById('lookupBtn')?.addEventListener('click',()=>{const v=document.getElementById('batchLookup')?.value.trim();const r=COA[v];const out=document.getElementById('lookupOut'); if(!out) return; out.style.display='block'; out.textContent=r?`VERIFIED\n${r.sample}\n${r.purity}\n${r.method}\n${r.lab}`:'NOT FOUND — CHECK BATCH FORMAT.';});
  }

  document.getElementById('cartItems')?.addEventListener('click',(e)=>{const t=e.target; if(!(t instanceof HTMLElement)) return; if(t.id==='upsellBacBtn'){ addSku('WA10'); return; } const sku=t.getAttribute('data-sku'); const a=t.getAttribute('data-a'); if(!sku||!a) return; if(a==='inc') chg(sku,1); if(a==='dec') chg(sku,-1); if(a==='rm') rmv(sku);});
  document.getElementById('notifyBtn')?.addEventListener('click',()=>{const em=document.getElementById('notifyEmail')?.value.trim(); if(!em) return; const list=JSON.parse(localStorage.getItem('ukmaxx_notify_list')||'[]'); list.push({email:em,ts:Date.now()}); localStorage.setItem('ukmaxx_notify_list',JSON.stringify(list)); console.log('UKMAXX notify signup saved:',em); document.getElementById('notifyEmail').value='';});

  const lb=document.getElementById('coaLightbox'), lbImg=document.getElementById('lbImg'), lbTitle=document.getElementById('lbTitle'), lbBody=document.getElementById('lbBody');
  const lbData=[
    {sel:'.coa-micro:nth-child(1)',title:'TAMPER SEAL INTEGRITY',body:'Each vial ships with a tamper-evident security seal applied before dispatch. If the seal is broken, missing, or shows signs of interference on arrival, do not use the product. Contact us immediately at the address in the footer for a replacement.'},
    {sel:'.coa-micro:nth-child(2)',title:'BATCH CODE TRACEABILITY',body:'Every UKMAXX vial carries a unique batch QR code printed on the label. Scanning the code takes you directly to the third-party COA results for that specific batch — confirming compound identity, purity percentage, test method, lab name, and report date. This links the physical vial in your lab directly to its verified test data.'}
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
    const banner=document.getElementById('checkoutBanner'); if(banner){banner.style.display='block'; banner.textContent='Payment cancelled — your basket has been saved';}
    drawer?.classList.add('open');
    history.replaceState({},'',location.pathname);
  }

  renderCart();
});