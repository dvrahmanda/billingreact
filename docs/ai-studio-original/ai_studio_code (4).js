const db = require('../config/database');
const { KODE_WILAYAH } = require('../config/constants');

const processMonthlyBilling = async () => {
  const connection = await db.getConnection();
  try {
    const now = new Date();
    const currentMonthFirst = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().slice(0, 10);

    await connection.query("SELECT GET_LOCK('billing_lifemedia_monthly_cron', 15)");
    await connection.beginTransaction();

    // 1. Dapatkan pelanggan aktif yang bulannya tertinggal
    const [outdated] = await connection.query(
      `SELECT * FROM pelanggan_salam 
       WHERE status_pelanggan = 'Aktif' AND waktu < ? FOR UPDATE`,
      [currentMonthFirst]
    );

    for (const p of outdated) {
      // Simpan periode lama ke tabel riwayat (tagihan_salam)
      const jatuhTempo = p.langganan_selesai || p.waktu;
      await connection.query(
        `INSERT INTO tagihan_salam 
         (pelanggan_id, periode, id_pelanggan_snapshot, nama_snapshot, alamat_snapshot, paket_snapshot, tarif_snapshot, nominal_tagihan, status_bayar, tanggal_jatuh_tempo, tanggal_bayar, nominal_dibayar, nomor_invoice)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status_bayar = VALUES(status_bayar)`,
        [
          p.id, p.waktu, p.id_pelanggan, p.nama, p.alamat, p.paket,
          p.tarif_langganan, p.tarif_langganan, p.status_bayar,
          jatuhTempo, p.tanggal_bayar, p.nominal_dibayar, p.nomor_invoice
        ]
      );

      // Hitung akhir bulan periode berjalan
      const lastDayCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().slice(0, 10);
      const prefix = KODE_WILAYAH[p.alamat] || p.alamat.substring(0, 3).toUpperCase();
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const newInvoice = `${prefix}/INV/${String(p.id).padStart(5, '0')}/${monthYear}`;

      // Perbarui bulan berjalan menjadi Belum Lunas
      await connection.query(
        `UPDATE pelanggan_salam SET
           waktu = ?,
           langganan_selesai = ?,
           status_bayar = 'Belum Lunas',
           tagihan = tarif_langganan,
           tanggal_bayar = NULL,
           nominal_dibayar = NULL,
           nomor_invoice = ?
         WHERE id = ?`,
        [currentMonthFirst, lastDayCurrentMonth, newInvoice, p.id]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.error('Error auto billing monthly cron:', err);
  } finally {
    await connection.query("SELECT RELEASE_LOCK('billing_lifemedia_monthly_cron')");
    connection.release();
  }
};

module.exports = { processMonthlyBilling };