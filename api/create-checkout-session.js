const Stripe = require('stripe');
const { getSupabaseAdmin } = require('./_lib/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
    if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Missing Stripe config' });

    const { cartItems, email, fullName, address, promoOptIn, promoCode } = req.body || {};
    if (!Array.isArray(cartItems) || !cartItems.length) return res.status(400).json({ error: 'Cart is empty' });

    const normalized = cartItems.map(i => ({ sku: String(i.sku || '').trim(), qty: Number(i.qty || 0) })).filter(i => i.sku && i.qty > 0);
    if (!normalized.length) return res.status(400).json({ error: 'Invalid cart items' });

    const supabase = getSupabaseAdmin();
    const skus = [...new Set(normalized.map(i => i.sku))];
    const { data: products, error } = await supabase.from('products').select('sku,name,price,stock_quantity,is_active').in('sku', skus);
    if (error) throw error;

    const bySku = new Map((products || []).map(p => [p.sku, p]));
    const line_items = [];
    let subtotal = 0;
    for (const item of normalized) {
      const p = bySku.get(item.sku);
      if (!p || !p.is_active) return res.status(400).json({ error: `Unavailable SKU: ${item.sku}` });
      if (Number(p.stock_quantity) < item.qty) return res.status(400).json({ error: `Insufficient stock for ${item.sku}` });
      const unit = Math.round(Number(p.price) * 100);
      subtotal += unit * item.qty;
      line_items.push({ price_data: { currency: 'gbp', product_data: { name: p.name, metadata: { sku: p.sku } }, unit_amount: unit }, quantity: item.qty });
    }
    const validPromo = String(promoCode || '').toUpperCase() === 'MAXX15';
    const discountAmount = validPromo ? Math.round(subtotal * 0.15) : 0;
    const discountedSubtotal = subtotal - discountAmount;
    const shipping = discountedSubtotal >= 10000 ? 0 : 499;
    if (shipping > 0) line_items.push({ price_data: { currency: 'gbp', product_data: { name: 'UK TRACKED SHIPPING', metadata: { sku: 'SHIPPING' } }, unit_amount: shipping }, quantity: 1 });

    const origin = process.env.SITE_URL;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email || undefined,
      line_items,
      shipping_address_collection: { allowed_countries: ['GB'] },
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      success_url: `${origin}/index.html?payment=success`,
      cancel_url: `${origin}/index.html?payment=cancelled`,
      discounts: validPromo ? [{ coupon: process.env.STRIPE_MAXX15_COUPON_ID || '' }].filter(d=>d.coupon) : undefined,
      metadata: {
        promo_opt_in: promoOptIn ? 'true' : 'false',
        promo_code: validPromo ? 'MAXX15' : '',
        discount_amount: String(discountAmount / 100),
        full_name: fullName || '',
        address_line1: address?.line1 || '',
        address_line2: address?.line2 || '',
        city: address?.city || '',
        postcode: address?.postal_code || '',
        country: address?.country || 'GB',
        cart: JSON.stringify(normalized),
        subtotal: String(subtotal / 100),
      },
    });

    return res.json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: 'Unable to start checkout' });
  }
};