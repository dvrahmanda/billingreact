import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';

const API = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api').replace(/\/$/, '');
const tabs = ['Ringkasan', 'Tagihan', 'Pembayaran', 'Complain', 'Notifikasi'];
const money = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const date = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
const label = (value) => String(value || '-').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

async function request(path, token, options = {}) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Permintaan gagal (${response.status}).`);
  return payload.data;
}

function Button({ title, onPress, kind = 'primary', disabled = false }) {
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.button, kind === 'outline' && styles.buttonOutline, disabled && styles.disabled]}><Text style={[styles.buttonText, kind === 'outline' && styles.buttonOutlineText]}>{title}</Text></TouchableOpacity>;
}

function Field({ value, onChangeText, placeholder, keyboardType, multiline = false, secureTextEntry = false }) {
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#93a0b2" keyboardType={keyboardType} multiline={multiline} secureTextEntry={secureTextEntry} style={[styles.input, multiline && styles.multiline]} />;
}

export default function App() {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState('Ringkasan');
  const [data, setData] = useState({ dashboard: null, bills: [], payments: [], complaints: [], notifications: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('internet_mati');
  const [description, setDescription] = useState('');
  const [complaintPhoto, setComplaintPhoto] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);

  const loadAll = useCallback(async (authToken = token) => {
    if (!authToken) return;
    const [dashboard, bills, payments, complaints, notifications] = await Promise.all([
      request('/mobile/customer/dashboard', authToken), request('/mobile/customer/bills', authToken),
      request('/mobile/customer/payments', authToken), request('/mobile/customer/complaints', authToken),
      request('/notifications?limit=50', authToken),
    ]);
    setData({ dashboard, bills: bills || [], payments: payments || [], complaints: complaints || [], notifications: notifications || [] });
  }, [token]);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync('lm_customer_token').then(async (saved) => {
      if (!saved || !active) { setLoading(false); return; }
      setToken(saved);
      try { await loadAll(saved); }
      catch { await SecureStore.deleteItemAsync('lm_customer_token'); if (active) setToken(''); }
      finally { if (active) setLoading(false); }
    }).catch(() => setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(() => loadAll(token).catch(() => {}), 60000);
    return () => clearInterval(timer);
  }, [token, loadAll]);

  const refresh = async () => {
    setRefreshing(true);
    try { await loadAll(); } catch (error) { Alert.alert('Gagal memuat data', error.message); }
    finally { setRefreshing(false); }
  };

  const login = async () => {
    setBusy(true);
    try {
      const response = await request('/auth/login', '', { method: 'POST', body: JSON.stringify({ username: username.trim(), password }) });
      if (response.user?.role !== 'pelanggan') throw new Error('Akun ini bukan akun Pelanggan.');
      await SecureStore.setItemAsync('lm_customer_token', response.token);
      setToken(response.token); setPassword('');
      await loadAll(response.token);
    } catch (error) { Alert.alert('Login gagal', error.message); }
    finally { setBusy(false); setLoading(false); }
  };

  const logout = async () => { await SecureStore.deleteItemAsync('lm_customer_token'); setToken(''); setData({ dashboard: null, bills: [], payments: [], complaints: [], notifications: [] }); };

  const choosePhoto = async (setPhoto) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setPhoto(result.assets[0]);
  };

  const payMidtrans = async (bill) => {
    setBusy(true);
    try {
      const result = await request('/mobile/customer/payments/midtrans', token, { method: 'POST', body: JSON.stringify({ tagihan_id: bill.id }) });
      if (result.redirect_url && result.redirect_url !== '#demo-payment') await Linking.openURL(result.redirect_url);
      else Alert.alert('Mode demo', `Order ${result.order_id} dibuat. Pembayaran simulasi dapat diselesaikan melalui webhook Midtrans.`);
      await loadAll();
    } catch (error) { Alert.alert('Pembayaran gagal dibuat', error.message); }
    finally { setBusy(false); }
  };

  const submitComplaint = async () => {
    if (description.trim().length < 10) return Alert.alert('Deskripsi belum cukup', 'Jelaskan gangguan minimal 10 karakter.');
    setBusy(true);
    try {
      const body = new FormData(); body.append('kategori', category); body.append('deskripsi', description.trim());
      if (complaintPhoto) body.append('file', { uri: complaintPhoto.uri, name: complaintPhoto.fileName || `gangguan-${Date.now()}.jpg`, type: complaintPhoto.mimeType || 'image/jpeg' });
      await request('/mobile/customer/complaints', token, { method: 'POST', body });
      setDescription(''); setComplaintPhoto(null); await loadAll(); Alert.alert('Complain terkirim', 'Admin Wilayah akan memverifikasi laporan Anda.');
    } catch (error) { Alert.alert('Complain gagal dikirim', error.message); }
    finally { setBusy(false); }
  };

  const openComplaint = async (item) => {
    try { setSelectedComplaint(await request(`/mobile/customer/complaints/${item.id}`, token)); }
    catch (error) { Alert.alert('Gagal membuka complain', error.message); }
  };

  const openBill = async (item) => {
    try { setSelectedBill(await request(`/mobile/customer/bills/${item.id}`, token)); }
    catch (error) { Alert.alert('Gagal membuka invoice', error.message); }
  };

  const markRead = async (item) => {
    try { await request(`/notifications/${item.id}/read`, token, { method: 'POST', body: '{}' }); await loadAll(); }
    catch (error) { Alert.alert('Notifikasi gagal diperbarui', error.message); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1570ef" /></View>;
  if (!token) return <View style={styles.loginPage}><Image source={require('./assets/cleon-logo.png')} resizeMode="contain" style={styles.brandLogo} /><Text style={styles.title}>Life Media</Text><Text style={styles.muted}>Masuk ke akun Pelanggan</Text><Field value={username} onChangeText={setUsername} placeholder="Username" /><Field value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry /><Button title={busy ? 'Memeriksa...' : 'Masuk'} onPress={login} disabled={busy} /><Text style={styles.footnote}>Pastikan alamat API perangkat diarahkan ke server Billing Life Media.</Text></View>;

  const dashboard = data.dashboard || {};
  const unread = (data.notifications || []).filter((item) => !item.dibaca_pada).length;
  const fileUri = (path) => path ? `${API.replace('/api', '')}/files/${String(path).replace(/^\/?uploads\//, '')}` : null;

  return <View style={styles.page}>
    <View style={styles.header}><View><Text style={styles.headerEyebrow}>BILLING LIFE MEDIA</Text><Text style={styles.headerTitle}>{dashboard.customer?.nama || 'Pelanggan'}</Text></View><TouchableOpacity onPress={logout}><Text style={styles.logout}>Keluar</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      {tab === 'Ringkasan' && <>
        <View style={styles.hero}><Text style={styles.heroLabel}>TOTAL TUNGGAKAN</Text><Text style={styles.heroAmount}>{money(dashboard.total_tunggakan)}</Text><Text style={styles.heroFoot}>{dashboard.customer?.wilayah || ''} · {dashboard.unpaid_bills?.length || 0} tagihan belum lunas</Text></View>
        <Section title="Tagihan Berjalan" />
        {dashboard.current_bill && <BillCard bill={dashboard.current_bill} onInvoice={() => openBill(dashboard.current_bill)} onMidtrans={() => payMidtrans(dashboard.current_bill)} />}
        <Section title="Tagihan Belum Lunas" />
        {(dashboard.unpaid_bills || []).slice(0, 3).map((bill) => <BillCard key={bill.id} bill={bill} onInvoice={() => openBill(bill)} onMidtrans={() => payMidtrans(bill)} />)}
        {!dashboard.unpaid_bills?.length && <Empty text="Semua tagihan Anda sudah lunas." />}
        <Section title="Complain Terbaru" />
        {(dashboard.recent_complaints || []).map((item) => <TouchableOpacity key={item.id} style={styles.rowCard} onPress={() => openComplaint(item)}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.nomor_tiket}</Text><Text style={styles.muted}>{label(item.kategori)}</Text></View><Pill value={item.status} /></TouchableOpacity>)}
      </>}

      {tab === 'Tagihan' && <>
        <Section title="Riwayat Tagihan" />
        {data.bills.map((bill) => <BillCard key={bill.id} bill={bill} onInvoice={() => openBill(bill)} onMidtrans={() => payMidtrans(bill)} />)}
        {!data.bills.length && <Empty text="Belum ada tagihan." />}
        {selectedBill && <View style={styles.card}><View style={styles.inline}><Text style={styles.cardTitle}>Invoice {selectedBill.nomor_invoice || `INV-${selectedBill.id}`}</Text><TouchableOpacity onPress={() => setSelectedBill(null)}><Text style={styles.link}>Tutup</Text></TouchableOpacity></View><Pill value={selectedBill.status_bayar} /><Text style={styles.bodyText}>Periode {date(selectedBill.periode)} · jatuh tempo {date(selectedBill.tanggal_jatuh_tempo)}</Text><Text style={styles.amount}>{money(selectedBill.nominal_tagihan)}</Text><Button kind="outline" title="Bagikan Ringkasan Invoice" onPress={() => Share.share({ message: `Invoice ${selectedBill.nomor_invoice || `INV-${selectedBill.id}`}\nPeriode: ${date(selectedBill.periode)}\nJatuh tempo: ${date(selectedBill.tanggal_jatuh_tempo)}\nNominal: ${money(selectedBill.nominal_tagihan)}\nStatus: ${label(selectedBill.status_bayar)}` })} /><Section title="Pembayaran Terkait" />{(selectedBill.payments || []).map((payment) => <View key={payment.id} style={styles.timeline}><View style={styles.rowMain}><Text style={styles.cardTitle}>{payment.order_id}</Text><Text style={styles.muted}>{date(payment.created_at)} · {payment.tipe_pembayaran === 'midtrans' ? (payment.metode || 'Midtrans') : 'Manual (arsip lama)'} · {money(payment.nominal_dibayar)} · {label(payment.status)}</Text>{payment.catatan_admin ? <Text style={styles.warningText}>{payment.catatan_admin}</Text> : null}</View></View>)}{!selectedBill.payments?.length && <Text style={styles.muted}>Belum ada pembayaran untuk invoice ini.</Text>}</View>}
      </>}

      {tab === 'Pembayaran' && <><Section title="Riwayat Pembayaran" />{data.payments.map((payment) => <View key={payment.id} style={styles.rowCard}><View style={styles.rowMain}><Text style={styles.cardTitle}>{payment.order_id}</Text><Text style={styles.muted}>{date(payment.created_at)} · {payment.tipe_pembayaran === 'midtrans' ? (payment.metode || 'Midtrans') : 'Pembayaran manual (arsip lama)'}</Text><Text style={styles.amount}>{money(payment.nominal_dibayar)}</Text>{payment.catatan_admin ? <Text style={styles.warningText}>Catatan Admin: {payment.catatan_admin}</Text> : null}</View><Pill value={payment.status} /></View>)}{!data.payments.length && <Empty text="Belum ada riwayat pembayaran." />}</>}

      {tab === 'Complain' && <>
        <View style={styles.card}><Text style={styles.cardTitle}>Buat Laporan Gangguan</Text><Button title={`Kategori: ${label(category)}`} kind="outline" onPress={() => Alert.alert('Pilih kategori', 'Pilih kategori gangguan', ['internet_mati','internet_lambat','perangkat','kabel_putus','lainnya'].map((item) => ({ text: label(item), onPress: () => setCategory(item) })))} /><Field value={description} onChangeText={setDescription} placeholder="Jelaskan gangguan yang dialami" multiline /><Button title={complaintPhoto ? 'Foto terpilih ✓' : 'Tambah Foto Gangguan'} kind="outline" onPress={() => choosePhoto(setComplaintPhoto)} />{complaintPhoto && <Image source={{ uri: complaintPhoto.uri }} style={styles.preview} />}<Button title={busy ? 'Mengirim...' : 'Kirim Complain'} onPress={submitComplaint} disabled={busy} /></View>
        <Section title="Riwayat Complain" />{data.complaints.map((item) => <TouchableOpacity key={item.id} style={styles.rowCard} onPress={() => openComplaint(item)}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.nomor_tiket}</Text><Text style={styles.muted}>{label(item.kategori)} · {date(item.created_at)}</Text></View><Pill value={item.status} /></TouchableOpacity>)}{!data.complaints.length && <Empty text="Belum ada laporan gangguan." />}
        {selectedComplaint && <View style={styles.card}><View style={styles.inline}><Text style={styles.cardTitle}>{selectedComplaint.nomor_tiket}</Text><TouchableOpacity onPress={() => setSelectedComplaint(null)}><Text style={styles.link}>Tutup</Text></TouchableOpacity></View><Pill value={selectedComplaint.status} /><Text style={styles.bodyText}>{selectedComplaint.deskripsi}</Text>{selectedComplaint.teknisi_nama && <Text style={styles.bodyText}>Teknisi: {selectedComplaint.teknisi_nama} · {selectedComplaint.teknisi_nomor_whatsapp || ''}</Text>}{selectedComplaint.foto_kendala && <Image source={{ uri: fileUri(selectedComplaint.foto_kendala), headers: { Authorization: `Bearer ${token}` } }} style={styles.preview} />}<Section title="Timeline" />{(selectedComplaint.timeline || []).map((event, index) => <Timeline key={`${event.created_at}-${index}`} event={event} />)}</View>}
      </>}

      {tab === 'Notifikasi' && <><View style={styles.inline}><Section title={`Notifikasi${unread ? ` · ${unread} belum dibaca` : ''}`} /><TouchableOpacity onPress={async () => { try { await request('/notifications/read-all', token, { method: 'POST', body: '{}' }); await loadAll(); } catch (error) { Alert.alert('Gagal', error.message); } }}><Text style={styles.link}>Baca semua</Text></TouchableOpacity></View>{data.notifications.map((item) => <TouchableOpacity key={item.id} style={[styles.rowCard, !item.dibaca_pada && styles.unread]} onPress={() => markRead(item)}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.judul}</Text><Text style={styles.bodyText}>{item.pesan}</Text><Text style={styles.muted}>{date(item.created_at)}</Text></View>{!item.dibaca_pada && <View style={styles.dot} />}</TouchableOpacity>)}{!data.notifications.length && <Empty text="Belum ada notifikasi." />}</>}
    </ScrollView>
    <View style={styles.tabBar}>{tabs.map((item) => <TouchableOpacity key={item} onPress={() => { setTab(item); setSelectedComplaint(null); }} style={[styles.tabButton, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === 'Notifikasi' && unread ? `${item} (${unread})` : item}</Text></TouchableOpacity>)}</View>
  </View>;
}

function Section({ title }) { return <Text style={styles.section}>{title}</Text>; }
function Empty({ text }) { return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>; }
function Pill({ value }) { const paid = ['lunas', 'closed', 'penanganan_selesai'].includes(String(value).toLowerCase()); return <View style={[styles.pill, paid ? styles.pillGreen : styles.pillAmber]}><Text style={[styles.pillText, paid ? styles.greenText : styles.amberText]}>{label(value)}</Text></View>; }
function BillCard({ bill, onInvoice, onMidtrans }) { const unpaid = bill.status_bayar !== 'Lunas'; return <View style={styles.card}><View style={styles.inline}><Text style={styles.cardTitle}>{bill.nomor_invoice || 'INV-' + bill.id}</Text><Pill value={bill.status_bayar} /></View><Text style={styles.muted}>Periode {date(bill.periode)} · jatuh tempo {date(bill.tanggal_jatuh_tempo)}</Text><Text style={styles.amount}>{money(bill.nominal_tagihan)}</Text><View style={styles.inline}><Button title='Invoice' kind='outline' onPress={onInvoice} />{unpaid && <Button title='Bayar via Midtrans' onPress={onMidtrans} />}</View></View>; }
function Timeline({ event }) { return <View style={styles.timeline}><View style={styles.timelineDot} /><View style={styles.rowMain}><Text style={styles.cardTitle}>{event.judul || label(event.status)}</Text><Text style={styles.muted}>{date(event.created_at)} · {event.aktor_nama || 'Life Media'}</Text>{event.keterangan ? <Text style={styles.bodyText}>{event.keterangan}</Text> : null}</View></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f6fa' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loginPage: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f3f6fa' }, brandLogo: { width: 150, height: 82, marginBottom: 18 }, title: { fontSize: 28, fontWeight: '800', color: '#10233f' }, muted: { color: '#738198', marginTop: 5, lineHeight: 20 }, footnote: { color: '#8b96a8', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18 },
  header: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e9eef5' }, headerEyebrow: { color: '#1570ef', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, headerTitle: { color: '#10233f', fontWeight: '800', fontSize: 19, marginTop: 3 }, logout: { color: '#d04343', fontWeight: '700' }, content: { padding: 16, paddingBottom: 30 }, hero: { padding: 21, borderRadius: 18, backgroundColor: '#155eef', marginBottom: 12 }, heroLabel: { color: '#d8e6ff', fontSize: 11, fontWeight: '800', letterSpacing: 1 }, heroAmount: { color: '#fff', fontSize: 29, fontWeight: '900', marginTop: 9 }, heroFoot: { color: '#d8e6ff', marginTop: 7 }, section: { color: '#20314a', fontWeight: '800', fontSize: 16, marginTop: 18, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#e9eef5', padding: 15, marginBottom: 11, gap: 9 }, paymentMethod: { borderWidth: 1, borderColor: '#e9eef5', borderRadius: 11, padding: 10, backgroundColor: '#f8faff' }, rowCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e9eef5', padding: 14, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 10 }, rowMain: { flex: 1 }, cardTitle: { color: '#192a43', fontWeight: '800', fontSize: 14 }, amount: { color: '#155eef', fontWeight: '900', fontSize: 19, marginTop: 8 }, bodyText: { color: '#42536b', fontSize: 13, lineHeight: 19, marginTop: 7 }, warningText: { color: '#b54708', fontSize: 12, marginTop: 6 }, inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  button: { backgroundColor: '#1570ef', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: 6 }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 13 }, buttonOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d0d9e7' }, buttonOutlineText: { color: '#34445d' }, disabled: { opacity: 0.55 }, input: { borderWidth: 1, borderColor: '#d9e1ec', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, color: '#192a43', backgroundColor: '#fff', marginTop: 8 }, multiline: { minHeight: 85, textAlignVertical: 'top' }, preview: { width: '100%', height: 190, borderRadius: 12, marginTop: 8 },
  pill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' }, pillGreen: { backgroundColor: '#e8f7ee' }, pillAmber: { backgroundColor: '#fff4e5' }, pillText: { fontSize: 10, fontWeight: '800' }, greenText: { color: '#18794e' }, amberText: { color: '#a15c07' }, empty: { padding: 18, alignItems: 'center', backgroundColor: '#fff', borderRadius: 13 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e4eaf2', paddingBottom: 14, paddingTop: 8 }, tabButton: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 2 }, tabActive: { borderTopWidth: 2, borderColor: '#1570ef' }, tabText: { color: '#7d899b', fontSize: 9, fontWeight: '700' }, tabTextActive: { color: '#1570ef' }, unread: { borderColor: '#9dc2ff', backgroundColor: '#f5f9ff' }, dot: { width: 8, height: 8, borderRadius: 8, backgroundColor: '#1570ef' }, link: { color: '#1570ef', fontWeight: '800', fontSize: 12 }, timeline: { flexDirection: 'row', gap: 10, borderLeftWidth: 1, borderColor: '#d8e1ed', paddingLeft: 12, paddingBottom: 14, marginLeft: 4 }, timelineDot: { width: 9, height: 9, borderRadius: 9, backgroundColor: '#1570ef', marginLeft: -17, marginTop: 4 },
});
