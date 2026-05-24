module.exports = async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY || '';
  const domain = process.env.DOMAIN || '';
  const mask = key ? `${key.slice(0,4)}...${key.slice(-2)}` : null;
  return res.json({
    stripeSecretPresent: !!key,
    stripeSecretMask: mask,
    domainPresent: !!domain,
    domainValue: domain || null,
  });
};