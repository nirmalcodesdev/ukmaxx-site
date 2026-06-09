import { toast } from './toast.js';
import { $, byId } from '../utils/dom.js';

export function setupTracking() {
  byId('trackForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ref = byId('trackRef')?.value.trim();
    const email = byId('trackEmail')?.value.trim();
    const result = byId('trackResult');
    if (!ref || !email) { toast('Missing details', 'Please enter both order reference and email.', 'error'); return; }
    if (result) {
      result.innerHTML = '<div class="track-loading"><div class="spinner"></div><span>Looking up your order…</span></div>';
      result.classList.add('is-shown');
    }
    try {
      const res = await fetch('/api/track-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref, email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order) {
        if (result) result.innerHTML = '<div class="track-error"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg><span>No order found. Check your reference number and email.</span></div>';
        return;
      }
      const o = data.order;
      if (result) {
        result.innerHTML = `<div class="track-card">
          <div class="track-card-head"><span>Order <strong>${o.reference || ref}</strong></span><span class="track-status ${(o.status || '').toLowerCase()}">${o.status || 'Processing'}</span></div>
          <div class="track-card-body">
            <div class="track-detail"><span>Status</span><span>${o.status || 'Processing'}</span></div>
            <div class="track-detail"><span>Date</span><span>${o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB') : '-'}</span></div>
            <div class="track-detail"><span>Items</span><span>${o.items || '-'}</span></div>
            <div class="track-detail"><span>Carrier</span><span>${o.carrier || '-'}</span></div>
            <div class="track-detail"><span>Tracking #</span><span>${o.tracking_number || '-'}</span></div>
            <div class="track-detail"><span>Est. delivery</span><span>${o.estimated_delivery ? new Date(o.estimated_delivery).toLocaleDateString('en-GB') : '-'}</span></div>
          </div>
        </div>`;
      }
    } catch {
      if (result) result.innerHTML = '<div class="track-error"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg><span>Network error — please try again.</span></div>';
    }
  });
}
