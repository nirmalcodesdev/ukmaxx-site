const Stripe = require('stripe');
const { getSupabaseAdmin } = require('./_lib/supabase');
const { sendOrderRefundedEmail, sendAdminOrderAlertEmail } = require('./_lib/email');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
    if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Missing Stripe config' });

    const { orderNumber, reason } = req.body || {};
    if (!orderNumber) return res.status(400).json({ error: 'orderNumber is required' });

    const supabase = getSupabaseAdmin();

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, email, total, status, stripe_session_id')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'refunded') {
      return res.status(400).json({ error: 'Order has already been refunded' });
    }

    if (!order.stripe_session_id) {
      return res.status(400).json({ error: 'No Stripe session found for this order' });
    }

    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    const paymentIntentId = session.payment_intent;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'No payment intent found for this session' });
    }

    const refundAmount = Math.round(Number(order.total) * 100);

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundAmount,
      reason: reason ? 'requested_by_customer' : undefined,
      metadata: {
        order_number: orderNumber,
        reason: reason || 'admin_initiated',
      },
    });

    await supabase
      .from('orders')
      .update({
        status: 'refunded',
        refunded_at: new Date().toISOString(),
        stripe_refund_id: refund.id,
      })
      .eq('id', order.id);

    await sendOrderRefundedEmail({
      to: order.email,
      orderNumber: order.order_number,
      total: order.total,
      refundDate: new Date().toLocaleDateString('en-GB'),
    });

    await supabase.from('admin_audit_log').insert({
      action: 'order_refunded',
      order_id: order.id,
      payload: {
        order_number: orderNumber,
        stripe_refund_id: refund.id,
        amount: refundAmount / 100,
        reason: reason || null,
      },
    });

    return res.status(200).json({
      success: true,
      orderNumber,
      stripeRefundId: refund.id,
      amount: refundAmount / 100,
    });
  } catch (err) {
    console.error('order-refund-error', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to refund order' });
  }
};
