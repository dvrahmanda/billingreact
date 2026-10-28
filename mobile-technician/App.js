import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';

const API = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api').replace(/\/$/, '');
const transitions = { ditugaskan: ['menuju_lokasi'], menuju_lokasi: ['menuju_lokasi', 'dalam_penanganan'], dalam_penanganan: ['dalam_penanganan', 'menunggu_material', 'penanganan_selesai'], menunggu_material: ['menunggu_material', 'dalam_penanganan'] };
const label = (value) => String(value || '-').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value) => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

async function request(path, token, options = {}) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Permintaan gagal (${response.status}).`);
  return payload.data;
}

function Button({ title, onPress, kind = 'primary', disabled = false }) { return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.button, kind === 'outline' && styles.buttonOutline, disabled && styles.disabled]}><Text style={[styles.buttonText, kind === 'outline' && styles.buttonOutlineText]}>{title}</Text></TouchableOpacity>; }
function Field({ value, onChangeText, placeholder, multiline = false }) { return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#93a0b2" multiline={multiline} style={[styles.input, multiline && styles.multiline]} />; }

export default function App() {
  const [token, setToken] = useState(''); const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [tab, setTab] = useState('Tugas'); const [tasks, setTasks] = useState([]); const [selected, setSelected] = useState(null); const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(''); const [cause, setCause] = useState(''); const [action, setAction] = useState(''); const [result, setResult] = useState(''); const [photo, setPhoto] = useState(null);

  const loadAll = useCallback(async (authToken = token, taskId = selected?.id) => {
    if (!authToken) return;
    const [taskRows, inbox] = await Promise.all([request('/mobile/technician/tasks', authToken), request('/notifications?limit=50', authToken)]);
    setTasks(taskRows || []); setNotifications(inbox || []);
    if (taskId) {
      const full = await request(`/mobile/technician/tasks/${taskId}`, authToken);
      setSelected(full); setNote(full.catatan_teknisi || ''); setCause(full.penyebab_gangguan || ''); setAction(full.tindakan_penanganan || ''); setResult(full.hasil_penanganan || '');
    }
  }, [token, selected?.id]);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync('lm_technician_token').then(async (saved) => {
      if (!saved || !active) { setLoading(false); return; }
      setToken(saved);
      try { await loadAll(saved, null); }
      catch { await SecureStore.deleteItemAsync('lm_technician_token'); if (active) setToken(''); }
      finally { if (active) setLoading(false); }
    }).catch(() => setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(() => loadAll(token).catch(() => {}), 60000);
    return () => clearInterval(timer);
  }, [token, loadAll]);

  const refresh = async () => { setRefreshing(true); try { await loadAll(); } catch (error) { Alert.alert('Gagal memuat tugas', error.message); } finally { setRefreshing(false); } };
  const login = async () => {
    setBusy(true);
    try {
      const response = await request('/auth/login', '', { method: 'POST', body: JSON.stringify({ username: username.trim(), password }) });
      if (response.user?.role !== 'teknisi') throw new Error('Akun ini bukan akun Teknisi.');
      await SecureStore.setItemAsync('lm_technician_token', response.token); setToken(response.token); setPassword(''); await loadAll(response.token, null);
    } catch (error) { Alert.alert('Login gagal', error.message); }
    finally { setBusy(false); setLoading(false); }
  };
  const logout = async () => { await SecureStore.deleteItemAsync('lm_technician_token'); setToken(''); setTasks([]); setSelected(null); };
  const openTask = async (task) => { setBusy(true); try { await loadAll(token, task.id); setTab('Tugas'); } catch (error) { Alert.alert('Gagal membuka tugas', error.message); } finally { setBusy(false); } };
  const choosePhoto = async () => { const response = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }); if (!response.canceled) setPhoto(response.assets[0]); };
  const updateStatus = async (status) => {
    if (status === 'penanganan_selesai' && (!action.trim() || !result.trim())) return Alert.alert('Data belum lengkap', 'Isi tindakan dan hasil sebelum menandai penanganan selesai.');
    setBusy(true);
    try {
      const body = new FormData(); body.append('status', status); body.append('catatan_teknisi', note); body.append('penyebab_gangguan', cause); body.append('tindakan_penanganan', action); body.append('hasil_penanganan', result);
      if (photo) body.append('file', { uri: photo.uri, name: photo.fileName || `penanganan-${Date.now()}.jpg`, type: photo.mimeType || 'image/jpeg' });
      await request(`/mobile/technician/tasks/${selected.id}/status`, token, { method: 'PATCH', body });
      setPhoto(null); await loadAll(token, selected.id); Alert.alert('Progres tersimpan', `Tugas diperbarui ke ${label(status)}.`);
    } catch (error) { Alert.alert('Progres gagal disimpan', error.message); }
    finally { setBusy(false); }
  };
  const markRead = async (item) => { try { await request(`/notifications/${item.id}/read`, token, { method: 'POST', body: '{}' }); await loadAll(); } catch (error) { Alert.alert('Gagal', error.message); } };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1570ef" /></View>;
  if (!token) return <View style={styles.loginPage}><View style={styles.brandMark}><Text style={styles.brandMarkText}>LM</Text></View><Text style={styles.title}>Life Media Teknisi</Text><Text style={styles.muted}>Masuk ke akun Teknisi</Text><Field value={username} onChangeText={setUsername} placeholder="Username" /><TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry placeholderTextColor="#93a0b2" style={styles.input} /><Button title={busy ? 'Memeriksa...' : 'Masuk'} onPress={login} disabled={busy} /><Text style={styles.footnote}>Tugas dan data pelanggan mengikuti penugasan Teknisi pada wilayahnya.</Text></View>;

  const active = tasks.filter((item) => !['closed', 'ditolak', 'penanganan_selesai'].includes(item.status));
  const fileUri = (path) => path ? `${API.replace('/api', '')}/files/${String(path).replace(/^\/?uploads\//, '')}` : null;
  const unread = notifications.filter((item) => !item.dibaca_pada).length;

  return <View style={styles.page}>
    <View style={styles.header}><View><Text style={styles.headerEyebrow}>LIFE MEDIA · TEKNISI</Text><Text style={styles.headerTitle}>{selected?.teknisi_nama || 'Tugas Lapangan'}</Text></View><TouchableOpacity onPress={logout}><Text style={styles.logout}>Keluar</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      {tab === 'Tugas' && <>
        <View style={styles.hero}><Text style={styles.heroLabel}>TUGAS AKTIF</Text><Text style={styles.heroAmount}>{active.length}</Text><Text style={styles.heroFoot}>{tasks.filter((item) => ['penanganan_selesai', 'closed'].includes(item.status)).length} penanganan selesai</Text></View>
        {!selected && <><Section title="Daftar Tugas" />{tasks.map((task) => <TouchableOpacity key={task.id} style={styles.rowCard} onPress={() => openTask(task)}><View style={styles.rowMain}><Text style={styles.cardTitle}>{task.nomor_tiket} · {task.nama}</Text><Text style={styles.muted}>{label(task.kategori)} · {task.alamat}</Text><Text style={styles.muted}>{date(task.created_at)}</Text></View><Pill value={task.status} /></TouchableOpacity>)}{!tasks.length && <Empty text="Belum ada tugas yang ditugaskan." />}</>}
        {selected && <>
          <View style={styles.inline}><Button title="← Daftar Tugas" kind="outline" onPress={() => setSelected(null)} /><Pill value={selected.status} /></View>
          <View style={styles.card}><Text style={styles.cardTitle}>{selected.nomor_tiket} · {selected.nama}</Text><Text style={styles.muted}>{selected.id_pelanggan} · {label(selected.kategori)}</Text><Text style={styles.bodyText}>{selected.deskripsi}</Text><Text style={styles.bodyText}>Alamat: {selected.alamat_lengkap || selected.alamat}</Text>
            <View style={styles.inline}><Button title="Hubungi WhatsApp" kind="outline" onPress={() => selected.nomor_pelanggan && Linking.openURL(`https://wa.me/${String(selected.nomor_pelanggan).replace(/\D/g, '')}`)} /><Button title="Buka Peta" kind="outline" onPress={() => selected.koordinat_y && selected.koordinat_x && Linking.openURL(`https://www.openstreetmap.org/?mlat=${selected.koordinat_y}&mlon=${selected.koordinat_x}#map=17/${selected.koordinat_y}/${selected.koordinat_x}`)} /></View>
            <Section title="Koneksi PPPoE" />{[['Username', selected.pppoe_user], ['Status', selected.pppoe_status], ['IP', selected.pppoe_ip], ['MAC', selected.pppoe_mac], ['Router', selected.pppoe_router], ['Uptime', selected.pppoe_uptime]].map(([key, value]) => <View key={key} style={styles.infoRow}><Text style={styles.muted}>{key}</Text><Text style={styles.infoValue}>{value || '-'}</Text></View>)}
            {selected.foto_kendala && <><Section title="Foto Gangguan" /><Image source={{ uri: fileUri(selected.foto_kendala), headers: { Authorization: `Bearer ${token}` } }} style={styles.preview} /></>}
            {selected.foto_hasil_penanganan && <><Section title="Foto Penanganan" /><Image source={{ uri: fileUri(selected.foto_hasil_penanganan), headers: { Authorization: `Bearer ${token}` } }} style={styles.preview} /></>}
          </View>
          {!['closed', 'ditolak', 'penanganan_selesai'].includes(selected.status) && <View style={styles.card}><Text style={styles.cardTitle}>Catatan Maintenance</Text><Field value={note} onChangeText={setNote} placeholder="Catatan teknisi" multiline /><Field value={cause} onChangeText={setCause} placeholder="Penyebab gangguan" multiline /><Field value={action} onChangeText={setAction} placeholder="Tindakan penanganan" multiline /><Field value={result} onChangeText={setResult} placeholder="Hasil penanganan" multiline /><Button title={photo ? 'Foto terpilih ✓' : 'Tambah Foto Bukti'} kind="outline" onPress={choosePhoto} />{photo && <Image source={{ uri: photo.uri }} style={styles.preview} />}{(transitions[selected.status] || []).map((next) => <Button key={next} title={busy ? 'Menyimpan...' : next === selected.status ? 'Simpan Progres' : `Ubah ke ${label(next)}`} onPress={() => updateStatus(next)} disabled={busy} />)}</View>}
          <View style={styles.card}><Section title="Riwayat Tugas" />{(selected.timeline || []).map((event, index) => <Timeline key={`${event.created_at}-${index}`} event={event} />)}</View>
        </>}
      </>}
      {tab === 'Notifikasi' && <><View style={styles.inline}><Section title={`Notifikasi${unread ? ` · ${unread} belum dibaca` : ''}`} /><TouchableOpacity onPress={async () => { try { await request('/notifications/read-all', token, { method: 'POST', body: '{}' }); await loadAll(); } catch (error) { Alert.alert('Gagal', error.message); } }}><Text style={styles.link}>Baca semua</Text></TouchableOpacity></View>{notifications.map((item) => <TouchableOpacity key={item.id} style={[styles.rowCard, !item.dibaca_pada && styles.unread]} onPress={() => markRead(item)}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.judul}</Text><Text style={styles.bodyText}>{item.pesan}</Text><Text style={styles.muted}>{date(item.created_at)}</Text></View>{!item.dibaca_pada && <View style={styles.dot} />}</TouchableOpacity>)}{!notifications.length && <Empty text="Belum ada notifikasi." />}</>}
    </ScrollView>
    <View style={styles.tabBar}>{['Tugas', 'Notifikasi'].map((item) => <TouchableOpacity key={item} onPress={() => setTab(item)} style={[styles.tabButton, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === 'Notifikasi' && unread ? `${item} (${unread})` : item}</Text></TouchableOpacity>)}</View>
  </View>;
}

function Section({ title }) { return <Text style={styles.section}>{title}</Text>; }
function Empty({ text }) { return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>; }
function Pill({ value }) { const done = ['closed', 'penanganan_selesai'].includes(String(value).toLowerCase()); return <View style={[styles.pill, done ? styles.pillGreen : styles.pillAmber]}><Text style={[styles.pillText, done ? styles.greenText : styles.amberText]}>{label(value)}</Text></View>; }
function Timeline({ event }) { return <View style={styles.timeline}><View style={styles.timelineDot} /><View style={styles.rowMain}><Text style={styles.cardTitle}>{event.judul || label(event.status)}</Text><Text style={styles.muted}>{date(event.created_at)} · {event.aktor_nama || 'Life Media'}</Text>{event.keterangan ? <Text style={styles.bodyText}>{event.keterangan}</Text> : null}</View></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f6fa' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, loginPage: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f3f6fa' }, brandMark: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#1570ef', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, brandMarkText: { color: '#fff', fontWeight: '900', fontSize: 20 }, title: { fontSize: 28, fontWeight: '800', color: '#10233f' }, muted: { color: '#738198', marginTop: 5, lineHeight: 20 }, footnote: { color: '#8b96a8', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18 },
  header: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e9eef5' }, headerEyebrow: { color: '#1570ef', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, headerTitle: { color: '#10233f', fontWeight: '800', fontSize: 19, marginTop: 3 }, logout: { color: '#d04343', fontWeight: '700' }, content: { padding: 16, paddingBottom: 30 }, hero: { padding: 21, borderRadius: 18, backgroundColor: '#155eef', marginBottom: 12 }, heroLabel: { color: '#d8e6ff', fontSize: 11, fontWeight: '800', letterSpacing: 1 }, heroAmount: { color: '#fff', fontSize: 29, fontWeight: '900', marginTop: 9 }, heroFoot: { color: '#d8e6ff', marginTop: 7 }, section: { color: '#20314a', fontWeight: '800', fontSize: 15, marginTop: 18, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#e9eef5', padding: 15, marginBottom: 11, gap: 8 }, rowCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e9eef5', padding: 14, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 10 }, rowMain: { flex: 1 }, cardTitle: { color: '#192a43', fontWeight: '800', fontSize: 14 }, bodyText: { color: '#42536b', fontSize: 13, lineHeight: 19, marginTop: 7 }, inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }, infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderColor: '#f0f3f7' }, infoValue: { color: '#253750', fontWeight: '700', maxWidth: '65%', textAlign: 'right' },
  button: { backgroundColor: '#1570ef', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: 6 }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 13 }, buttonOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d0d9e7' }, buttonOutlineText: { color: '#34445d' }, disabled: { opacity: 0.55 }, input: { borderWidth: 1, borderColor: '#d9e1ec', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, color: '#192a43', backgroundColor: '#fff', marginTop: 8 }, multiline: { minHeight: 70, textAlignVertical: 'top' }, preview: { width: '100%', height: 190, borderRadius: 12, marginTop: 8 },
  pill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' }, pillGreen: { backgroundColor: '#e8f7ee' }, pillAmber: { backgroundColor: '#fff4e5' }, pillText: { fontSize: 10, fontWeight: '800' }, greenText: { color: '#18794e' }, amberText: { color: '#a15c07' }, empty: { padding: 18, alignItems: 'center', backgroundColor: '#fff', borderRadius: 13 }, tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e4eaf2', paddingBottom: 14, paddingTop: 8 }, tabButton: { flex: 1, alignItems: 'center', paddingVertical: 8 }, tabActive: { borderTopWidth: 2, borderColor: '#1570ef' }, tabText: { color: '#7d899b', fontSize: 12, fontWeight: '700' }, tabTextActive: { color: '#1570ef' }, unread: { borderColor: '#9dc2ff', backgroundColor: '#f5f9ff' }, dot: { width: 8, height: 8, borderRadius: 8, backgroundColor: '#1570ef' }, link: { color: '#1570ef', fontWeight: '800', fontSize: 12 }, timeline: { flexDirection: 'row', gap: 10, borderLeftWidth: 1, borderColor: '#d8e1ed', paddingLeft: 12, paddingBottom: 14, marginLeft: 4 }, timelineDot: { width: 9, height: 9, borderRadius: 9, backgroundColor: '#1570ef', marginLeft: -17, marginTop: 4 },
});
