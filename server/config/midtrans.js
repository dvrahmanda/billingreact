const midtransClient = require('midtrans-client');
require('dotenv').config();
const snap = new midtransClient.Snap({
  isProduction: String(process.env.MIDTRANS_IS_PRODUCTION).toLowerCase() === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'DUMMY',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'DUMMY'
});
module.exports = snap;
