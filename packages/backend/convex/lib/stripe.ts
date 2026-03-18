export const importStripe = async () => {
  const stripeModule = await import('stripe');
  return stripeModule.default;
};
