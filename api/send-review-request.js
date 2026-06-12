const { getSupabaseAdmin } = require('./_lib/supabase');
const { sendReviewRequestEmail } = require('./_lib/email');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orderNumber } = req.body || {};
    if (!orderNumber) return res.status(400).json({ error: 'orderNumber is required' });

    const supabase = getSupabaseAdmin();

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, email, total, status, delivered_at, review_request_sent_at')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'delivered') {
      return res.status(400).json({ error: `Cannot send review request for order with status "${order.status}". Only "delivered" orders qualify.` });
    }

    if (order.review_request_sent_at) {
      return res.status(400).json({ error: 'Review request has already been sent for this order' });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, sku, qty, line_total')
      .eq('order_id', order.id);

    await sendReviewRequestEmail({
      to: order.email,
      orderNumber: order.order_number,
      items: items || [],
    });

    const now = new Date().toISOString();

    await supabase
      .from('orders')
      .update({ review_request_sent_at: now })
      .eq('id', order.id);

    await supabase.from('admin_audit_log').insert({
      action: 'review_request_sent',
      order_id: order.id,
      payload: { order_number: orderNumber },
    });

    return res.status(200).json({ success: true, orderNumber });
  } catch (err) {
    console.error('send-review-request-error', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to send review request' });
  }
};
