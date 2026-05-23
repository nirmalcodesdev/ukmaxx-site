const CART_KEY='ukmaxx_cart_v1';
const money=n=>`£${Number(n).toFixed(2)}`;
const getCart=()=>JSON.parse(localStorage.getItem(CART_KEY)||'[]');
const setCart=c=>localStorage.setItem(CART_KEY,JSON.stringify(c));
const STRIPE_PUBLISHABLE_KEY='STRIPE_PUBLISHABLE_KEY';

function renderCart(){
  const countEl=document.getElementById('cartCount');
  const itemsEl=document.getElementById('cartItems');
  const totalsEl=document.getElementById('cartTotals');
  const summaryEl=document.getElementById('checkoutSummary');
  const c=getCart();
  if(countEl) countEl.textContent=String(c.reduce((a,b)=>a+b.qty,0));
  if(!itemsEl||!totalsEl||!summaryEl) return;
  if(!c.length){ itemsEl.innerHTML='<p style="color:var(--dim)">Basket empty.</p>'; totalsEl.textContent=''; summaryEl.textContent=''; return; }
  itemsEl.innerHTML=c.map(i=>`<div class='cart-item'><div class='cart-item-row'><img class='cart-thumb' src='${PRODUCTS[i.sku].image}' alt='${PRODUCTS[i.sku].name}'><div style='min-width:0;flex:1'><div><strong>${PRODUCTS[i.sku]?.name||i.sku}</strong></div><div style='margin-top:4px'>${money(PRODUCTS[i.sku].price)} x ${i.qty}</div><div class='qty'><button aria-label='Decrease quantity' data-a='dec' data-sku='${i.sku}'>-</button><button aria-label='Increase quantity' data-a='inc' data-sku='${i.sku}'>+</button><button aria-label='Remove item' style='margin-left:auto;padding:8px 10px;min-height:36px' data-a='rm' data-sku='${i.sku}'>Remove</button></div></div></div></div>`).join('');
  const sub=c.reduce((a,b)=>a+PRODUCTS[b.sku].price*b.qty,0), ship=sub?4.99:0, tot=sub+ship;
  totalsEl.innerHTML=`Subtotal ${money(sub)}<br>Shipping ${money(ship)}<br><strong>Total ${money(tot)}</strong>`;
  summaryEl.textContent=`ORDER SUMMARY\nSubtotal: ${money(sub)}\nShipping: ${money(ship)}\nTotal: ${money(tot)}\nSecure laboratory procurement flow.`;
}
function addSku(s){const c=getCart();const f=c.find(x=>x.sku===s); if(f) f.qty++; else c.push({sku:s,qty:1}); setCart(c); renderCart();}
function chg(s,d){const c=getCart(); const f=c.find(x=>x.sku===s); if(!f) return; f.qty+=d; if(f.qty<=0)c.splice(c.indexOf(f),1); setCart(c); renderCart();}
function rmv(s){setCart(getCart().filter(x=>x.sku!==s)); renderCart();}

function orderRef(){ return `UKM-${Math.random().toString(36).slice(2,7).toUpperCase()}`; }

async function startCheckout(){
  const email=document.getElementById('email')?.value.trim();
  const fullName=document.getElementById('fullName')?.value.trim();
  const address=document.getElementById('address')?.value.trim();
  const country=document.getElementById('country')?.value;
  const err=document.getElementById('checkoutError');
  if(err){ err.style.display='none'; err.textContent=''; }
  if(!email||!fullName||!address||!country){ if(err){err.textContent='Please complete email, name, and address before payment.';err.style.display='block';} return; }
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

  const res=await fetch('/api/create-checkout-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,customerEmail:email,customerName:fullName,address:{line1:address,country}})});
  const data=await res.json();
  if(!res.ok||!data.url){ if(err){err.textContent='Unable to start payment. Please try again.';err.style.display='block';} return; }
  window.location.href=data.url;
}

document.addEventListener('DOMContentLoaded',()=>{
  const params=new URLSearchParams(location.search);
  const success=params.get('payment')==='success';
  const cancelled=params.get('payment')==='cancelled';

  document.querySelectorAll('#products .product-card .add-btn').forEach(b=>b.addEventListener('click',()=>{
    const sku=(b.closest('.product-body')?.querySelector('.product-sku')?.textContent||'').split('—')[0].trim(); if(sku) addSku(sku);
  }));
  document.getElementById('shopNowBtn')?.addEventListener('click',()=>document.querySelector('#products')?.scrollIntoView({behavior:'smooth'}));
  const drawer=document.getElementById('cartDrawer');
  const cartFab=document.getElementById('cartFab');
  cartFab?.addEventListener('click',()=>drawer?.classList.add('open'));
  document.getElementById('cartClose')?.addEventListener('click',()=>drawer?.classList.remove('open'));
  let scrollTimer; window.addEventListener('scroll',()=>{ if(!cartFab) return; cartFab.classList.add('scrolling'); clearTimeout(scrollTimer); scrollTimer=setTimeout(()=>cartFab.classList.remove('scrolling'),300); },{passive:true});
  document.getElementById('checkoutBtn')?.addEventListener('click',()=>document.getElementById('checkoutModal')?.classList.add('open'));
  document.getElementById('checkoutClose')?.addEventListener('click',()=>document.getElementById('checkoutModal')?.classList.remove('open'));
  document.getElementById('payBtn')?.addEventListener('click',startCheckout);

  const coaBody=document.querySelector('.coa-body');
  if(coaBody){
    coaBody.insertAdjacentHTML('beforeend',`<div class='coa-tool'><input id='batchLookup' placeholder='Enter Batch ID (e.g. RT10-2026-05-A)' style='width:100%;padding:12px;min-height:44px;border:1px solid var(--border)'><button id='lookupBtn' class='add-btn' style='margin-top:8px;min-height:44px;width:100%'>VERIFY BATCH</button><div id='lookupOut' class='coa-result-box' style='display:none'></div></div>`);
    document.getElementById('lookupBtn')?.addEventListener('click',()=>{const v=document.getElementById('batchLookup')?.value.trim();const r=COA[v];const out=document.getElementById('lookupOut'); if(!out) return; out.style.display='block'; out.textContent=r?`VERIFIED\n${r.sample}\n${r.purity}\n${r.method}\n${r.lab}`:'NOT FOUND — CHECK BATCH FORMAT.';});
  }

  document.getElementById('cartItems')?.addEventListener('click',(e)=>{const t=e.target; if(!(t instanceof HTMLElement)) return; const sku=t.getAttribute('data-sku'); const a=t.getAttribute('data-a'); if(!sku||!a) return; if(a==='inc') chg(sku,1); if(a==='dec') chg(sku,-1); if(a==='rm') rmv(sku);});

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