const Stripe = require('stripe');
const { getSupabaseAdmin } = require('./_lib/supabase');
const { sendTelegramAdminAlert } = require('./_lib/notify');
const { sendOrderConfirmationEmail } = require('./_lib/email');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const raw = Buffer.concat(chunks);
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabase = getSupabaseAdmin();
  const existing = await supabase.from('stripe_events').select('id').eq('stripe_event_id', event.id).maybeSingle();
  if (existing.data) return res.status(200).json({ received: true, duplicate: true });

  await supabase.from('stripe_events').insert({ stripe_event_id: event.id, event_type: event.type, payload: event });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const stripeSessionId = session.id;

    const priorOrder = await supabase.from('orders').select('id,order_number').eq('stripe_session_id', stripeSessionId).maybeSingle();
    if (!priorOrder.data) {
      const cart = JSON.parse(session.metadata?.cart || '[]');
      const skus = cart.map(i => i.sku);
      const { data: products } = await supabase.from('products').select('sku,name,price,stock_quantity').in('sku', skus);
      const bySku = new Map((products || []).map(p => [p.sku, p]));
      const orderItems = cart.map(i => {
        const p = bySku.get(i.sku);
        const lineTotal = Number(p.price) * Number(i.qty);
        return { sku: i.sku, product_name: p.name, qty: i.qty, price: p.price, line_total: lineTotal };
      });
      const subtotal = orderItems.reduce((a, b) => a + Number(b.line_total), 0);
      const shipping = 4.99;
      const total = subtotal + shipping;
      const orderNumber = `UKX-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random()*9000))}`;

      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        order_number: orderNumber,
        stripe_session_id: stripeSessionId,
        email: (session.customer_details?.email || '').toLowerCase(),
        full_name: session.metadata?.full_name || session.customer_details?.name || 'Customer',
        phone: session.customer_details?.phone || null,
        shipping_address_line1: session.shipping_details?.address?.line1 || session.metadata?.address_line1 || '',
        shipping_address_line2: session.shipping_details?.address?.line2 || session.metadata?.address_line2 || null,
        shipping_city: session.shipping_details?.address?.city || session.metadata?.city || '',
        shipping_postcode: session.shipping_details?.address?.postal_code || session.metadata?.postcode || '',
        shipping_country: session.shipping_details?.address?.country || session.metadata?.country || 'GB',
        subtotal,
        discount: 0,
        shipping,
        total,
        currency: 'gbp',
        status: 'paid',
        promo_opt_in: session.metadata?.promo_opt_in === 'true',
      }).select('*').single();
      if (orderErr) return res.status(500).json({ error: 'order_create_failed' });

      await supabase.from('order_items').insert(orderItems.map(i => ({ ...i, order_id: order.id })));
      for (const i of cart) {
        await supabase.rpc('decrement_stock', { p_sku: i.sku, p_qty: i.qty }).catch(async () => {
          const p = bySku.get(i.sku);
          await supabase.from('products').update({ stock_quantity: Math.max(0, Number(p.stock_quantity) - Number(i.qty)) }).eq('sku', i.sku);
        });
      }

      if (order.promo_opt_in && order.email) {
        await supabase.from('subscribers').upsert({ email: order.email.toLowerCase(), source: 'checkout_optin', promo_opt_in: true, consent_timestamp: new Date().toISOString() }, { onConflict: 'email' });
      }

      const promoCode = String(session.metadata?.promo_code || '').toUpperCase();
      if (promoCode === 'MAXX15' && order.email) {
        await supabase.from('promo_redemptions').upsert({
          email: order.email.toLowerCase(),
          promo_code: 'MAXX15',
          stripe_session_id: stripeSessionId,
          order_id: order.id,
          redeemed_at: new Date().toISOString(),
        }, { onConflict: 'email,promo_code' });
      }

      const itemText = orderItems.map(i => `• ${i.product_name} x${i.qty}`).join('\n');
      await sendTelegramAdminAlert(`✅ <b>NEW ORDER</b>\nOrder: <b>${order.order_number}</b>\nTotal: <b>£${order.total.toFixed(2)}</b>\nCustomer: ${order.email}\n${itemText}\nShip: ${order.shipping_postcode}, ${order.shipping_country}\nSession: <code>${stripeSessionId}</code>`);

      await sendOrderConfirmationEmail({
        to: order.email,
        orderNumber: order.order_number,
        items: orderItems,
        total: order.total,
        shipping: {
          line1: order.shipping_address_line1,
          line2: order.shipping_address_line2,
          city: order.shipping_city,
          postcode: order.shipping_postcode,
          country: order.shipping_country,
        },
      });
    }
  }

  return res.status(200).json({ received: true });
};

module.exports.config = { api: { bodyParser: false } };