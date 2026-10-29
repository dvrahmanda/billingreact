import React,{useEffect,useState} from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import Button from '../../components/common/Button';
import BackButton from '../../components/common/BackButton';
import Card from '../../components/common/Card';
import { apiGet,apiPost,apiPut } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
const blank={id_pelanggan:'',kode_pelanggan:'',nama:'',nama_ktp:'',nik:'',nomor_pelanggan:'',alamat:'SALAM',alamat_lengkap:'',paket:'',tarif_langganan:'',status_pelanggan:'Aktif',tanggal_daftar:'',koordinat_x:'',koordinat_y:'',pppoe_user:'',username_mobile:'',password_mobile:''};
export default function CustomerFormPage({mode}){
 const {id}=useParams(),nav=useNavigate();const{user}=useAuth(); const [form,setForm]=useState({...blank,alamat:user?.wilayah||'SALAM'}),[busy,setBusy]=useState(false);
 useEffect(()=>{if(mode==='edit')apiGet(`/customers/${id}`).then(r=>setForm({...blank,...r.data,alamat:r.data.wilayah||r.data.alamat})).catch(e=>alert(e.friendlyMessage||'Data pelanggan gagal dimuat.'))},[id,mode]);
 const set=(k,v)=>setForm(f=>({...f,[k]:v})); const submit=async e=>{e.preventDefault();if(Boolean(form.username_mobile)!==Boolean(form.password_mobile))return alert('Isi username dan password mobile bersama-sama.');if(form.password_mobile&&form.password_mobile.length<8)return alert('Password mobile minimal 8 karakter.');setBusy(true);try{if(mode==='edit'){await apiPut(`/customers/${id}`,form);if(form.username_mobile)await apiPost(`/customers/${id}/mobile-account`,{username:form.username_mobile,password:form.password_mobile})}else await apiPost('/customers',form);nav('/customers')}catch(err){alert(err.friendlyMessage||'Gagal menyimpan')}finally{setBusy(false)}};
 return <div className="page-container"><div className="page-header"><div className="page-heading"><BackButton to={mode==='edit'?`/customers/${id}`:'/customers'} /><div><h1>{mode==='edit'?'Edit Pelanggan':'Tambah Pelanggan'}</h1><p>Lengkapi identitas, layanan, dan data koneksi pelanggan.</p></div></div></div><Card><form onSubmit={submit}><div className="form-grid">
 {[
 ['id_pelanggan','ID Pelanggan','text'],['kode_pelanggan','Kode Pelanggan','text'],['nama','Nama Pelanggan','text'],['nama_ktp','Nama KTP','text'],['nik','NIK','text'],['nomor_pelanggan','Nomor WhatsApp','text'],['alamat_lengkap','Alamat Lengkap','text'],
 ['paket','Paket Internet','text'],['tarif_langganan','Tarif','number'],['tanggal_daftar','Tanggal Aktif','date'],['koordinat_x','Koordinat Longitude','number'],['koordinat_y','Koordinat Latitude','number'],['pppoe_user','Username PPPoE','text']
 ].map(([k,l,t])=><div className="form-group" key={k}><label className="form-label">{l}</label><input type={t} step={t==='number'?'any':undefined} className="form-control" value={form[k]??''} onChange={e=>set(k,e.target.value)} disabled={mode==='edit'&&k==='id_pelanggan'} /></div>)}
 <div className="form-group"><label className="form-label">Wilayah</label><select className="form-control" value={form.alamat} disabled={user?.role!=='superadmin'} onChange={e=>set('alamat',e.target.value)}>{['BARAN','GUNUNGMANUK','NGASEMAYU','SALAM','TROSARI','WADUK'].map(w=><option key={w}>{w}</option>)}</select></div>
 <div className="form-group"><label className="form-label">Status Pelanggan</label><select className="form-control" value={form.status_pelanggan} onChange={e=>set('status_pelanggan',e.target.value)}><option>Aktif</option><option>Tidak Aktif</option></select></div>
 <div className="form-group"><label className="form-label">Username Mobile (opsional)</label><input className="form-control" autoComplete="off" value={form.username_mobile} onChange={e=>set('username_mobile',e.target.value)}/><div className="table-sub">Buat atau perbarui akun aplikasi Pelanggan.</div></div>
 <div className="form-group"><label className="form-label">Password Mobile</label><input type="password" className="form-control" autoComplete="new-password" value={form.password_mobile} onChange={e=>set('password_mobile',e.target.value)}/><div className="table-sub">Minimal 8 karakter. Kosongkan jika akun tidak diubah.</div></div>
 </div><div style={{display:'flex',justifyContent:'flex-end',gap:9,marginTop:20}}><Button type="button" variant="outline" onClick={()=>nav(-1)}>Batal</Button><Button disabled={busy}>{busy?'Menyimpan...':'Simpan Pelanggan'}</Button></div></form></Card></div>;
}
