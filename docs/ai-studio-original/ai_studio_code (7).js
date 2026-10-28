const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const { processMonthlyBilling } = require('./services/automatedBillingService');

const app = express();

// Keamanan & Middleware Dasar
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Akses Static Folder Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/billings', require('./routes/billingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/pppoe', require('./routes/pppoeRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/technicians', require('./routes/technicianRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/admins', require('./routes/adminRoutes'));

// Error Handler Terpusat
app.use(require('./middleware/errorHandler'));

// Cron Job: Berjalan tiap tanggal 1 pukul 00:05 WIB untuk sinkronisasi tagihan bulanan
cron.schedule('5 0 1 * *', async () => {
  console.log('[CRON] Menjalankan transisi billing bulanan otomatis...');
  await processMonthlyBilling();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server Billing Life Media aktif di port ${PORT}`);
});