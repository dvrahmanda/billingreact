import React,{useEffect,useState} from 'react';
import { useParams } from 'react-router-dom';
import { apiGet,apiPost } from '../../services/api';
import Card from '../../components/common/Card';
import Badge,{statusVariant} from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import PrivateImage from '../../components/common/PrivateImage';
import { formatDateIndo,labelStatus } from '../../utils/formatters';

export default function ComplaintDetailPage(){
 const{id}=useParams();const[d,setD]=useState(null),[techs,setTechs]=useState([]),[assignOpen,setAssignOpen]=useState(false),[tid,setTid]=useState(''),[error,setError]=useState('');
 const load=()=>apiGet(`/complaints/${id}`).then(r=>{setD(r.data);setError('')}).catch(e=>setError(e.friendlyMessage||'Complain gagal dimuat.'));
 useEffect(()=>{setD(null);load();apiGet('/technicians').then(r=>setTechs(r.data||[])).catch(()=>{})},[id]);
 const verify=async action=>{let alasan='';if(action==='reject'){alasan=prompt('Masukkan alasan penolakan:')||'';if(!alasan.trim())return alert('Alasan penolakan wajib diisi.')}try{await apiPost(`/complaints/${id}/verify`,{action,alasan});load()}catch(e){alert(e.friendlyMessage||'Perubahan complain gagal.')}};
 const assign=async()=>{try{await apiPost(`/complaints/${id}/assign`,{technician_id:Number(tid)});setAssignOpen(false);load()}catch(e){alert(e.friendlyMessage||'Penugasan gagal.')}};
 const close=async()=>{if(!confirm('Verifikasi hasil dan tutup complain ini?'))return;try{await apiPost(`/complaints/${id}/close`,{});load()}catch(e){alert(e.friendlyMessage||'Complain gagal ditutup.')}};
 if(!d&&!error)return <div className="screen-center" style={{minHeight:350}}><div className="spinner"/></div>;
 if(!d)return <div className="page-container"><div className="alert alert-danger">{error}</div></div>;
 return <div className="page-container"><div className="page-header"><div><h1>{d.nomor_tiket}</h1><p>{d.nama} · {d.alamat} · {d.alamat_lengkap||''}</p></div><Badge variant={statusVariant(d.status)}>{labelStatus(d.status)}</Badge></div>
  <div className="header-actions">{d.status==='menunggu_verifikasi'&&<><Button variant="success" onClick={()=>verify('approve')}>Verifikasi Complain</Button><Button variant="danger" onClick={()=>verify('reject')}>Tolak</Button></>}{d.status==='terverifikasi'&&<Button onClick={()=>setAssignOpen(true)}>Tugaskan Teknisi</Button>}{d.status==='penanganan_selesai'&&<Button variant="success" onClick={close}>Verifikasi Hasil & Tutup</Button>}</div>
  <div className="two-col"><Card title="Detail Gangguan"><div className="info-grid" style={{gridTemplateColumns:'1fr 1fr'}}>{[['Kategori',labelStatus(d.kategori)],['Dibuat',formatDateIndo(d.created_at,true)],['PPPoE',d.pppoe_user_snapshot||d.pppoe_user||'-'],['Status PPPoE',d.pppoe_status||'-'],['Teknisi',d.teknisi_nama||'-'],['Lokasi',d.koordinat_y&&d.koordinat_x?`${d.koordinat_y}, ${d.koordinat_x}`:'-']].map(([label,value])=><div className="info-item" key={label}><div className="info-label">{label}</div><div className="info-value">{value}</div></div>)}</div><div style={{marginTop:14}}><div className="form-label">Deskripsi</div><div style={{fontSize:12}}>{d.deskripsi}</div></div>{d.alasan_penolakan&&<div className="alert alert-danger" style={{marginTop:12}}>Alasan penolakan: {d.alasan_penolakan}</div>}{d.foto_kendala&&<div style={{marginTop:14}}><div className="form-label">Foto Gangguan</div><PrivateImage path={d.foto_kendala} alt="Foto gangguan" style={{maxWidth:'100%',maxHeight:320,borderRadius:10}}/></div>}</Card>
   <Card title="Hasil Penanganan"><div className="info-grid" style={{gridTemplateColumns:'1fr'}}>{[['Penyebab',d.penyebab_gangguan],['Tindakan',d.tindakan_penanganan],['Hasil',d.hasil_penanganan],['Catatan Teknisi',d.catatan_teknisi]].map(([label,value])=><div className="info-item" key={label}><div className="info-label">{label}</div><div className="info-value">{value||'-'}</div></div>)}</div>{d.foto_hasil_penanganan&&<PrivateImage path={d.foto_hasil_penanganan} alt="Bukti penanganan" style={{maxWidth:'100%',maxHeight:320,borderRadius:10,marginTop:14}}/>}</Card></div>
   <Card title="Timeline Penanganan"><div className="timeline">{(d.timeline||[]).map((item,index)=><div className="timeline-item" key={item.id||index}><div className="timeline-dot-wrap"><span className="timeline-dot"/><span className="timeline-line"/></div><div><div className="timeline-title">{item.judul}</div><div className="timeline-meta">{formatDateIndo(item.created_at,true)} · {item.aktor_nama}</div><div className="timeline-desc">{item.keterangan}</div></div></div>)}</div></Card>
  {assignOpen&&<Modal title="Tugaskan Teknisi" onClose={()=>setAssignOpen(false)}><div className="card-body"><label className="form-label">Pilih Teknisi</label><select className="form-control" value={tid} onChange={e=>setTid(e.target.value)}><option value="">Pilih teknisi...</option>{techs.filter(t=>t.wilayah_tugas===d.alamat&&t.status!=='off').map(t=><option key={t.id} value={t.id}>{t.nama} · {t.wilayah_tugas} · {labelStatus(t.status)}</option>)}</select><div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}><Button disabled={!tid} onClick={assign}>Konfirmasi Penugasan</Button></div></div></Modal>}
 </div>;
}
