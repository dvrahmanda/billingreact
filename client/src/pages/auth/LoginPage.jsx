import React,{useState} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import { BarChart3, Network, ShieldCheck, WalletCards } from 'lucide-react';
export default function LoginPage(){
  const {login}=useAuth(); const navigate=useNavigate(); const [username,setUsername]=useState('superadmin'); const [password,setPassword]=useState('admin123'); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setError('');setBusy(true);try{await login(username,password);navigate('/dashboard')}catch(err){setError(err.friendlyMessage||err.message||'Login gagal')}finally{setBusy(false)}};
  return <div className="login-page"><section className="login-hero"><div><div className="brand-row"><div className="brand-mark" style={{background:'#fff'}}>LM</div><div><div className="brand-title">Life Media</div><div className="brand-subtitle">Internet Billing Platform</div></div></div></div>
    <div style={{position:'relative',zIndex:2}}><h1>Billing yang lebih terhubung, terukur, dan mudah dipantau.</h1><p>Kelola pelanggan, tagihan, pembayaran, PPPoE, laporan, hingga penanganan gangguan dari satu pusat operasional.</p></div>
    <div className="login-pills"><span className="login-pill">Billing & Pembayaran</span><span className="login-pill">Monitoring PPPoE</span><span className="login-pill">Complain & Teknisi</span><span className="login-pill">Analitik</span></div></section>
    <section className="login-side"><form className="card login-card" onSubmit={submit}><div className="login-logo"><div className="login-logo-mark">LM</div><div><strong>Billing Internet</strong><div className="table-sub">PT Sarana Insan Muda Selaras</div></div></div><h2>Selamat datang</h2><p className="desc">Masuk sebagai Super Admin atau Admin Wilayah.</p>
      {error&&<div className="alert alert-danger" style={{marginBottom:12}}>{error}</div>}
      <div className="form-group" style={{marginBottom:13}}><label className="form-label">Username</label><input className="form-control" value={username} onChange={e=>setUsername(e.target.value)} required/></div>
      <div className="form-group" style={{marginBottom:18}}><label className="form-label">Password</label><input type="password" className="form-control" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
      <Button style={{width:'100%'}} disabled={busy}>{busy?'Memproses...':'Masuk ke Sistem'}</Button>
      <div className="login-help">Mode demo: <b>superadmin</b> / <b>admin123</b>. Untuk Admin Wilayah coba <b>admin_salam</b> / <b>admin123</b>.</div>
    </form></section></div>;
}
