const { getSupabaseAdmin } = require('./_lib/supabase');
const { sendOrderDispatchedEmail } = require('./_lib/email');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orderNumber, trackingNumber, expectedDate, packedDate, dispatchedDate } = req.body || {};
    if (!orderNumber) return res.status(400).json({ error: 'orderNumber is required' });

    const supabase = getSupabaseAdmin();

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, email, total, status')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, sku, qty, line_total')
      .eq('order_id', order.id);

    const now = new Date().toISOString();

    await supabase
      .from('orders')
      .update({
        status: 'dispatched',
        tracking_number: trackingNumber || null,
        dispatched_at: now,
      })
      .eq('id', order.id);

    await sendOrderDispatchedEmail({
      to: order.email,
      orderNumber: order.order_number,
      items: items || [],
      total: order.total,
      trackingNumber: trackingNumber || '—',
      expectedDate: expectedDate || '—',
      packedDate: packedDate || '—',
      dispatchedDate: dispatchedDate || new Date().toLocaleDateString('en-GB'),
    });

    await supabase.from('admin_audit_log').insert({
      action: 'order_dispatched',
      order_id: order.id,
      payload: {
        order_number: orderNumber,
        tracking_number: trackingNumber,
        expected_date: expectedDate,
      },
    });

    return res.status(200).json({ success: true, orderNumber });
  } catch (err) {
    console.error('order-dispatch-error', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to dispatch order' });
  }
};
