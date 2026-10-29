import React,{useState} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import { BarChart3, Network, ShieldCheck, WalletCards } from 'lucide-react';
export default function LoginPage(){
  const {login}=useAuth(); const navigate=useNavigate(); const [username,setUsername]=useState('superadmin'); const [password,setPassword]=useState('admin123'); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setError('');setBusy(true);try{await login(username,password);navigate('/dashboard')}catch(err){setError(err.friendlyMessage||err.message||'Login gagal')}finally{setBusy(false)}};
  return <div className="login-page"><section className="login-hero">
    <div className="login-copy"><span className="login-eyebrow">Billing Internet CLEON</span><h1>Billing yang lebih terhubung, terukur, dan mudah dipantau.</h1><p>Kelola pelanggan, tagihan, pembayaran, PPPoE, laporan, hingga penanganan gangguan dari satu pusat operasional.</p></div>
    <div className="login-pills"><span className="login-pill"><WalletCards size={17} /><span>Billing &amp; Pembayaran</span></span><span className="login-pill"><Network size={17} /><span>Monitoring PPPoE</span></span><span className="login-pill"><ShieldCheck size={17} /><span>Complain &amp; Teknisi</span></span><span className="login-pill"><BarChart3 size={17} /><span>Analitik</span></span></div></section>
    <section className="login-side"><form className="card login-card" onSubmit={submit}><div className="login-intro"><img className="login-logo-image" src="/cleon-logo.png" alt="CLEON Internet Access" /><h2>Welcome back</h2><p className="desc">Sign in to Billing Multiwilayah</p></div>
      {error&&<div className="alert alert-danger" style={{marginBottom:12}}>{error}</div>}
      <div className="form-group" style={{marginBottom:13}}><label className="form-label">Username</label><input className="form-control" value={username} onChange={e=>setUsername(e.target.value)} required/></div>
      <div className="form-group" style={{marginBottom:18}}><label className="form-label">Password</label><input type="password" className="form-control" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
      <Button style={{width:'100%'}} disabled={busy}>{busy?'Memproses...':'Masuk ke Sistem'}</Button>
    </form></section></div>;
}
