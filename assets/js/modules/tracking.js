import { toast } from './toast.js';
import { byId } from '../utils/dom.js';

const STATUS_ORDER = ['paid', 'processing', 'dispatched', 'delivered'];
const STATUS_LABELS = { paid: 'Paid', processing: 'Processing', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded' };
const STATUS_CLASSES = { paid: 'is-paid', processing: 'is-processing', dispatched: 'is-transit', delivered: 'is-done', cancelled: 'is-cancelled', refunded: 'is-refunded' };

export function setupTracking() {
  const params = new URLSearchParams(location.search);
  const prefillOrder = params.get('order') || '';
  if (prefillOrder) {
    const el = byId('orderNumber');
    if (el) el.value = prefillOrder;
  }

  byId('trackForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ref = byId('orderNumber')?.value.trim();
    const email = byId('orderEmail')?.value.trim();
    const result = byId('trackResult');
    if (!ref || !email) { toast('Missing details', 'Please enter both order number and email.', 'error'); return; }
    if (result) {
      result.style.display = 'none';
      result.classList.remove('is-shown');
    }
    const submitBtn = byId('trackSubmit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Looking up…'; }
    try {
      const res = await fetch('/api/track-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref, email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order) {
        toast('Order not found', 'Check your order number and email and try again.', 'error');
        return;
      }
      renderOrder(data.order);
    } catch {
      toast('Network error', 'Please try again.', 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:16px;height:16px"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg> Track my order'; }
    }
  });
}

function renderOrder(o) {
  const result = byId('trackResult');
  if (!result) return;

  byId('resOrder').textContent = o.order_number || '';
  byId('resCarrier').textContent = o.carrier || '—';
  const statusEl = byId('resStatus');
  const cls = STATUS_CLASSES[o.status] || 'is-processing';
  statusEl.className = `result-status ${cls}`;
  statusEl.textContent = STATUS_LABELS[o.status] || o.status || 'Unknown';

  const statusIdx = STATUS_ORDER.indexOf(o.status);
  const timeline = byId('timeline');
  if (timeline) {
    const items = timeline.querySelectorAll('.timeline-item');
    const statuses = ['order_placed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
    items.forEach((item, i) => {
      item.className = 'timeline-item';
      if (i < statusIdx + 1) {
        item.classList.add('is-done');
      } else if (i === statusIdx + 1 && o.status === 'dispatched') {
        item.classList.add('is-active');
      } else {
        item.classList.add('is-future');
      }
      if (o.status === 'delivered' && i === 4) {
        item.classList.remove('is-future');
        item.classList.add('is-done');
      }
    });

    const times = timeline.querySelectorAll('.timeline-time');
    if (times[0]) times[0].textContent = o.created_at ? formatDate(o.created_at) : '—';
    if (times[1]) times[1].textContent = o.packed_at ? formatDate(o.packed_at) : (o.created_at ? formatDate(o.created_at) : '—');
    if (times[2]) times[2].textContent = o.dispatched_at ? formatDate(o.dispatched_at) : '—';
    if (times[3]) times[3].textContent = o.dispatched_at ? formatDate(o.dispatched_at) : '—';
    if (times[4]) times[4].textContent = o.delivered_at ? formatDate(o.delivered_at) : (o.estimated_delivery ? `Est. ${formatDate(o.estimated_delivery)}` : '—');

    const details = timeline.querySelectorAll('.timeline-detail');
    if (details[0]) details[0].textContent = 'Payment confirmed via Stripe. Order queued for fulfilment.';
    if (details[1]) details[1].textContent = 'Batch codes cross-referenced with COA. Sealed in tamper-evident packaging.';
    if (details[2]) details[2].innerHTML = o.tracking_number ? `Tracking number: <strong>${o.tracking_number}</strong> · handed to carrier.` : 'Package handed to carrier.';
    if (details[3]) details[3].innerHTML = 'Courier is on the route.' + (o.estimated_delivery ? ` Estimated delivery: <strong>${formatDate(o.estimated_delivery)}</strong>.` : '');
    if (details[4]) details[4].textContent = o.delivered_at ? 'Package delivered successfully.' : 'A delivery confirmation email will be sent within 5 minutes of delivery.';
  }

  const itemsContainer = result.querySelector('.result-items');
  if (itemsContainer && o.items) {
    itemsContainer.innerHTML = o.items.map(i => `
      <div class="result-item">
        <img class="result-item-img" src="${i.image_url || './images/placeholder.jpg'}" alt="${i.product_name}">
        <div class="result-item-info">
          <div class="result-item-name">${i.product_name}</div>
          <div class="result-item-meta">${i.sku} · Qty ${i.qty}</div>
        </div>
        <div class="result-item-price">£${Number(i.line_total).toFixed(2)}</div>
      </div>
    `).join('');
  }

  const metaRows = result.querySelectorAll('.result-meta-list .result-meta-row');
  if (metaRows.length >= 6) {
    const shipTo = [o.shipping_address_line1, o.shipping_city, o.shipping_postcode].filter(Boolean).join('<br>');
    metaRows[0].querySelector('.result-meta-val').innerHTML = shipTo || '—';
    metaRows[1].querySelector('.result-meta-val').textContent = o.carrier || '—';
    metaRows[2].querySelector('.result-meta-val').textContent = o.tracking_number || '—';
    metaRows[3].querySelector('.result-meta-val').textContent = `£${Number(o.subtotal || 0).toFixed(2)}`;
    metaRows[4].querySelector('.result-meta-val').textContent = Number(o.shipping || 0) === 0 ? 'Free' : `£${Number(o.shipping).toFixed(2)}`;
    metaRows[5].querySelector('.result-meta-val').textContent = `£${Number(o.total || 0).toFixed(2)}`;
  }

  const carrierLink = result.querySelector('.result-actions-buttons a.btn-ghost');
  if (carrierLink && o.tracking_url) {
    carrierLink.href = o.tracking_url;
  }

  const lastUpdated = result.querySelector('.result-actions-meta');
  if (lastUpdated) {
    lastUpdated.textContent = `Last updated just now`;
  }

  result.style.display = '';
  result.classList.add('is-shown');
}

function formatDate(d) {
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return String(d); }
}
