const snap = require('../config/midtrans');
const { isDemo } = require('../utils/helpers');

async function createTransactionToken(orderId, grossAmount, customerDetails) {
  if (!process.env.MIDTRANS_SERVER_KEY) {
    if (isDemo()) return { token: `DEMO-${orderId}`, redirect_url: '#demo-payment' };
    throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi.');
  }
  return snap.createTransaction({
    transaction_details: { order_id: orderId, gross_amount: Number(grossAmount) },
    customer_details: customerDetails,
  });
}

module.exports = { createTransactionToken };
