const { Resend } = require('resend');

async function sendOrderConfirmationEmail({ to, orderNumber, items, total, shipping }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  const resend = new Resend(key);
  const lines = items.map(i => `• ${i.product_name} x${i.qty} — £${Number(i.line_total).toFixed(2)}`).join('<br/>');
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@ukmaxx.co.uk';
  const html = `<div style="font-family:DM Sans,Arial,sans-serif;background:#f4f8f9;padding:24px;color:#081f23">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #c6d9dc">
    <div style="background:#0b0f12;color:#fff;padding:14px 18px;font-family:'Bebas Neue',Arial,sans-serif;font-size:30px;letter-spacing:.08em">UKMAXX</div>
    <div style="padding:18px 18px 10px">
      <div style="font-size:12px;letter-spacing:.08em;color:#4f727b;text-transform:uppercase">Order Confirmation</div>
      <div style="font-size:24px;font-weight:700;margin-top:6px">${orderNumber}</div>
      <div style="margin-top:14px;line-height:1.8">${lines}</div>
      <div style="margin-top:14px;border-top:1px solid #e1edf0;padding-top:12px"><strong>Total:</strong> £${Number(total).toFixed(2)}</div>
      <div style="margin-top:10px"><strong>Shipping:</strong><br/>${shipping.line1}${shipping.line2 ? `<br/>${shipping.line2}` : ''}<br/>${shipping.city}, ${shipping.postcode}<br/>${shipping.country}</div>
      <div style="margin-top:14px;font-size:12px;color:#4f727b">All products sold for laboratory research use only.</div>
    </div>
    <div style="padding:12px 18px;border-top:1px solid #e1edf0;font-size:12px;color:#4f727b">Support: ${supportEmail}</div>
  </div>
  </div>`;
  await resend.emails.send({ from: process.env.RESEND_FROM || 'UKMAXX <orders@ukmaxx.com>', to, subject: `UKMAXX Order Confirmation — ${orderNumber}`, html });
}

async function sendAdminOrderAlertEmail({ orderNumber, customerEmail, fullName, phone, items, total, shipping, stripeSessionId }) {
  const key = process.env.RESEND_API_KEY;
  const adminTo = process.env.ADMIN_ORDER_EMAIL || 'ahmedsjasim1@gmail.com';
  if (!key || !adminTo) return;

  const resend = new Resend(key);
  const lines = items.map(i => `• ${i.product_name} x${i.qty} — £${Number(i.line_total).toFixed(2)}`).join('<br/>');
  const address = [shipping.line1, shipping.line2, shipping.city, shipping.postcode, shipping.country].filter(Boolean).join(', ');

  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
    <h2>New UKMAXX Order</h2>
    <p><strong>Order:</strong> ${orderNumber}<br/>
    <strong>Total:</strong> £${Number(total).toFixed(2)}<br/>
    <strong>Customer:</strong> ${customerEmail}<br/>
    <strong>Name:</strong> ${fullName || 'N/A'}<br/>
    <strong>Phone:</strong> ${phone || 'N/A'}<br/>
    <strong>Address:</strong> ${address || 'N/A'}<br/>
    <strong>Stripe Session:</strong> ${stripeSessionId}</p>
    <p><strong>Items</strong><br/>${lines}</p>
  </div>`;

  await resend.emails.send({
    from: process.env.RESEND_FROM || 'UKMAXX <orders@ukmaxx.com>',
    to: adminTo,
    subject: `New Order ${orderNumber} — £${Number(total).toFixed(2)}`,
    html,
  });
}

module.exports = { sendOrderConfirmationEmail, sendAdminOrderAlertEmail };
