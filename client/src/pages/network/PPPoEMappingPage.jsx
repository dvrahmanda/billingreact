import React,{useEffect,useState} from 'react';
import { apiGet,apiPost } from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

export default function PPPoEMappingPage(){
 const[rows,setRows]=useState([]),[busy,setBusy]=useState(false);
 const load=()=>apiGet('/pppoe/unmatched').then(r=>setRows(r.data||[])).catch(e=>alert(e.friendlyMessage||'Akun PPPoE gagal dimuat.'));
 useEffect(()=>{load()},[]);
 const connect=async row=>{const id=prompt(`Masukkan ID internal pelanggan yang akan dihubungkan dengan ${row.username}:`);if(!id)return;try{await apiPost('/pppoe/map',{username:row.username,pelanggan_id:Number(id)});await load()}catch(e){alert(e.friendlyMessage||'Mapping gagal.')}};
 const match=async()=>{setBusy(true);try{const result=await apiPost('/pppoe/match',{});alert(`${result.data.matched.length} mapping otomatis dibuat; ${result.data.skipped.length} perlu pencocokan manual.`);await load()}catch(e){alert(e.friendlyMessage||'Matching otomatis gagal.')}finally{setBusy(false)}};
 const cols=[{header:'Username PPPoE',accessor:'username'},{header:'Wilayah',accessor:'wilayah'},{header:'IP',accessor:'ip'},{header:'Status',accessor:r=><Badge variant={r.status==='ONLINE'?'success':'danger'}>{r.status}</Badge>},{header:'Aksi',accessor:r=><Button size="sm" onClick={()=>connect(r)}>Hubungkan Pelanggan</Button>}];
 return <div className="page-container"><div className="page-header"><div><h1>Matching PPPoE</h1><p>Hubungkan akun PPPoE yang belum cocok dengan data pelanggan billing. Tidak membuat akun jaringan baru.</p></div><Button disabled={busy||!rows.length} onClick={match}>{busy?'Mencocokkan...':'Matching Otomatis'}</Button></div><div className="alert" style={{background:'var(--color-highlight)',color:'#6a572f'}}>Sistem mencocokkan ID/kode, nama pelanggan/KTP, lalu koordinat dalam radius 30 meter. Mapping hanya dibuat untuk satu kecocokan di wilayah yang sama; kecocokan ganda dilewati.</div><DataTable columns={cols} data={rows}/></div>;
}
