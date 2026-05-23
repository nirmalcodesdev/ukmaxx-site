const CART_KEY='ukmaxx_cart_v1';
const money=n=>`£${Number(n).toFixed(2)}`;
const getCart=()=>JSON.parse(localStorage.getItem(CART_KEY)||'[]');
const setCart=c=>localStorage.setItem(CART_KEY,JSON.stringify(c));

function renderCart(){
  const countEl=document.getElementById('cartCount');
  const itemsEl=document.getElementById('cartItems');
  const totalsEl=document.getElementById('cartTotals');
  const summaryEl=document.getElementById('checkoutSummary');
  const c=getCart();
  if(countEl) countEl.textContent=String(c.reduce((a,b)=>a+b.qty,0));
  if(!itemsEl||!totalsEl||!summaryEl) return;
  if(!c.length){ itemsEl.innerHTML='<p style="color:var(--dim)">Basket empty.</p>'; totalsEl.textContent=''; summaryEl.textContent=''; return; }
  itemsEl.innerHTML=c.map(i=>`<div class='cart-item'><div><strong>${PRODUCTS[i.sku]?.name||i.sku}</strong></div><div style='margin-top:4px'>${money(PRODUCTS[i.sku].price)} x ${i.qty}</div><div class='qty'><button aria-label='Decrease quantity' data-a='dec' data-sku='${i.sku}'>-</button><button aria-label='Increase quantity' data-a='inc' data-sku='${i.sku}'>+</button><button aria-label='Remove item' style='margin-left:auto;padding:8px 10px;min-height:36px' data-a='rm' data-sku='${i.sku}'>Remove</button></div></div>`).join('');
  const sub=c.reduce((a,b)=>a+PRODUCTS[b.sku].price*b.qty,0), ship=sub?4.99:0, tot=sub+ship;
  totalsEl.innerHTML=`Subtotal ${money(sub)}<br>Shipping ${money(ship)}<br><strong>Total ${money(tot)}</strong>`;
  summaryEl.textContent=`ORDER SUMMARY\nSubtotal: ${money(sub)}\nShipping: ${money(ship)}\nTotal: ${money(tot)}\nSecure laboratory procurement flow.`;
}
function addSku(s){const c=getCart();const f=c.find(x=>x.sku===s); if(f) f.qty++; else c.push({sku:s,qty:1}); setCart(c); renderCart();}
function chg(s,d){const c=getCart(); const f=c.find(x=>x.sku===s); if(!f) return; f.qty+=d; if(f.qty<=0)c.splice(c.indexOf(f),1); setCart(c); renderCart();}
function rmv(s){setCart(getCart().filter(x=>x.sku!==s)); renderCart();}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('#products .product-card .add-btn').forEach(b=>b.addEventListener('click',()=>{
    const sku=(b.closest('.product-body')?.querySelector('.product-sku')?.textContent||'').split('—')[0].trim(); if(sku) addSku(sku);
  }));
  document.getElementById('shopNowBtn')?.addEventListener('click',()=>document.querySelector('#products')?.scrollIntoView({behavior:'smooth'}));
  const drawer=document.getElementById('cartDrawer');
  document.getElementById('cartFab')?.addEventListener('click',()=>drawer?.classList.add('open'));
  document.getElementById('cartClose')?.addEventListener('click',()=>drawer?.classList.remove('open'));
  document.getElementById('checkoutBtn')?.addEventListener('click',()=>document.getElementById('checkoutModal')?.classList.add('open'));
  document.getElementById('checkoutClose')?.addEventListener('click',()=>document.getElementById('checkoutModal')?.classList.remove('open'));

  const coaBody=document.querySelector('.coa-body');
  if(coaBody){
    coaBody.insertAdjacentHTML('beforeend',`<div class='coa-tool'><input id='batchLookup' placeholder='Enter Batch ID (e.g. RT10-2026-05-A)' style='width:100%;padding:12px;min-height:44px;border:1px solid var(--border)'><button id='lookupBtn' class='add-btn' style='margin-top:8px;min-height:44px;width:100%'>VERIFY BATCH</button><div id='lookupOut' class='coa-result-box' style='display:none'></div></div>`);
    document.getElementById('lookupBtn')?.addEventListener('click',()=>{const v=document.getElementById('batchLookup')?.value.trim();const r=COA[v];const out=document.getElementById('lookupOut'); if(!out) return; out.style.display='block'; out.textContent=r?`VERIFIED\n${r.sample}\n${r.purity}\n${r.method}\n${r.lab}`:'NOT FOUND — CHECK BATCH FORMAT.';});
  }

  document.getElementById('cartItems')?.addEventListener('click',(e)=>{const t=e.target; if(!(t instanceof HTMLElement)) return; const sku=t.getAttribute('data-sku'); const a=t.getAttribute('data-a'); if(!sku||!a) return; if(a==='inc') chg(sku,1); if(a==='dec') chg(sku,-1); if(a==='rm') rmv(sku);});

  renderCart();
});