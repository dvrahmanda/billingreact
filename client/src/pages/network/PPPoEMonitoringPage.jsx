import React,{useEffect,useState} from 'react';
import { apiDelete,apiGet } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/common/DataTable';
import Badge,{statusVariant} from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { formatDateIndo } from '../../utils/formatters';

export default function PPPoEMonitoringPage(){
 const{user}=useAuth();const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[wilayah,setWilayah]=useState('all');
 const load=(silent=false)=>{if(!silent)setLoading(true);apiGet(`/pppoe?wilayah=${encodeURIComponent(wilayah)}`).then(r=>setRows(r.data||[])).catch(e=>{if(!silent)alert(e.friendlyMessage||'Data PPPoE gagal dimuat.')}).finally(()=>{if(!silent)setLoading(false)})};useEffect(()=>{load();const timer=setInterval(()=>load(true),5000);return()=>clearInterval(timer)},[wilayah]);
 const disconnect=async row=>{if(!confirm(`Putuskan mapping ${row.username} dari pelanggan ${row.customer_name}?`))return;try{await apiDelete(`/pppoe/map/${encodeURIComponent(row.username)}`);load()}catch(e){alert(e.friendlyMessage||'Mapping gagal diputus.')}};
 const cols=[{header:'Username',accessor:'username'},{header:'Pelanggan',accessor:r=><div><div className="table-title">{r.customer_name||'-'}</div><div className="table-sub">{r.wilayah||'-'}</div></div>},{header:'IP',accessor:'ip'},{header:'MAC',accessor:'mac'},{header:'Router',accessor:'router'},{header:'Uptime',accessor:'uptime'},{header:'Status',accessor:r=><Badge variant={statusVariant(r.status)}>{r.status}</Badge>},{header:'Mapping',accessor:r=><div style={{display:'flex',alignItems:'center',gap:8}}><Badge variant={r.customer_id?'success':'warning'}>{r.customer_id?'Terhubung':'Belum Terhubung'}</Badge>{r.customer_id&&<Button variant="outline" size="sm" onClick={()=>disconnect(r)}>Putuskan</Button>}</div>},{header:'Last Update',accessor:r=>formatDateIndo(r.last_update,true)}];
 return <div className="page-container"><div className="page-header"><div><h1>Monitoring PPPoE</h1><p>Online/offline, IP, MAC, router, uptime, dan waktu pembaruan dari gateway jaringan.</p></div>{user?.role==='superadmin'&&<select className="form-control" style={{width:190}} value={wilayah} onChange={e=>setWilayah(e.target.value)}><option value="all">Semua Wilayah</option>{['BARAN','GUNUNGMANUK','NGASEMAYU','SALAM','TROSARI','WADUK'].map(w=><option key={w}>{w}</option>)}</select>}</div><DataTable columns={cols} data={rows} loading={loading}/></div>;
}
