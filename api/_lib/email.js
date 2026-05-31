const { Resend } = require('resend');

async function sendOrderConfirmationEmail({ to, orderNumber, items, total, shipping }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  const resend = new Resend(key);
  const lines = items.map(i => `• ${i.product_name} x${i.qty} — £${Number(i.line_total).toFixed(2)}`).join('<br/>');
  const html = `<p>Order confirmation: <strong>${orderNumber}</strong></p>
  <p>${lines}</p>
  <p><strong>Total:</strong> £${Number(total).toFixed(2)}</p>
  <p><strong>Shipping:</strong><br/>${shipping.line1}${shipping.line2 ? `<br/>${shipping.line2}` : ''}<br/>${shipping.city}, ${shipping.postcode}<br/>${shipping.country}</p>
  <p>All products sold for research use only.</p>
  <p>Support: support@ukmaxx.com</p>`;
  await resend.emails.send({ from: process.env.RESEND_FROM || 'UKMAXX <orders@ukmaxx.com>', to, subject: `UKMAXX Order Confirmation — ${orderNumber}`, html });
}

module.exports = { sendOrderConfirmationEmail };
