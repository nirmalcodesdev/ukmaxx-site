const { getSupabaseAdmin } = require('./_lib/supabase');
const { sendOrderCancelledEmail, sendAdminOrderAlertEmail } = require('./_lib/email');

const VALID_PRIOR_STATUSES = ['pending', 'paid', 'processing', 'dispatched'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orderNumber, reason, refund } = req.body || {};
    if (!orderNumber) return res.status(400).json({ error: 'orderNumber is required' });

    const supabase = getSupabaseAdmin();

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, email, total, status, stripe_session_id')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!VALID_PRIOR_STATUSES.includes(order.status)) {
      return res.status(400).json({
        error: `Cannot cancel order with status "${order.status}". Valid prior statuses: ${VALID_PRIOR_STATUSES.join(', ')}`,
      });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, sku, qty, line_total')
      .eq('order_id', order.id);

    const wasPaid = order.status === 'paid' || order.status === 'processing' || order.status === 'dispatched';
    const shouldRefund = wasPaid && refund !== false;

    await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancellation_reason: reason || null,
      })
      .eq('id', order.id);

    await sendOrderCancelledEmail({
      to: order.email,
      orderNumber: order.order_number,
      items: items || [],
      total: order.total,
      refundInitiated: shouldRefund,
    });

    if (shouldRefund) {
      await supabase.from('admin_audit_log').insert({
        action: 'order_cancelled_with_refund_needed',
        order_id: order.id,
        payload: { order_number: orderNumber, reason: reason || null, stripe_session_id: order.stripe_session_id },
      });
    }

    await supabase.from('admin_audit_log').insert({
      action: 'order_cancelled',
      order_id: order.id,
      payload: { order_number: orderNumber, reason: reason || null, was_paid: wasPaid, refund_initiated: shouldRefund },
    });

    return res.status(200).json({
      success: true,
      orderNumber,
      wasPaid,
      refundInitiated: shouldRefund,
    });
  } catch (err) {
    console.error('order-cancel-error', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to cancel order' });
  }
};
