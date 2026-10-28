const midtransClient = require('midtrans-client');
require('dotenv').config();

const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'dummy_server_key',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'dummy_client_key',
});

const createTransactionToken = async (orderId, grossAmount, customerDetails) => {
  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Math.round(grossAmount),
    },
    customer_details: {
      first_name: customerDetails.nama,
      phone: customerDetails.nomor_pelanggan,
      billing_address: {
        address: customerDetails.alamat,
      },
    },
  };

  const transaction = await snap.createTransaction(parameter);
  return transaction; // { token, redirect_url }
};

module.exports = { snap, createTransactionToken };