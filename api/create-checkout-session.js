const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { items, customerEmail, customerName, address } = req.body || {};
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: customerEmail,
      line_items: items,
      mode: 'payment',
      shipping_address_collection: { allowed_countries: ['GB'] },
      success_url: `${process.env.DOMAIN}/index.html?payment=success`,
      cancel_url: `${process.env.DOMAIN}/index.html?payment=cancelled`,
      payment_intent_data: {
        statement_descriptor: 'OCTA LAB SUPPLIES',
      },
      metadata: {
        business_name: 'OCTA TECHNOLOGIES',
        customer_name: customerName || '',
        address_line1: address?.line1 || '',
      },
    });
    return res.json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};