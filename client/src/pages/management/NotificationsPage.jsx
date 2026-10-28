import React,{useEffect,useState} from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { apiGet,apiPost } from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { formatDateIndo,labelStatus } from '../../utils/formatters';

export default function NotificationsPage(){
 const[rows,setRows]=useState([]),[busy,setBusy]=useState(false);
 const load=()=>apiGet('/notifications?limit=100').then(r=>setRows(r.data||[])).catch(e=>alert(e.friendlyMessage||'Notifikasi gagal dimuat.'));
 useEffect(()=>{load()},[]);
 const markAll=async()=>{setBusy(true);try{await apiPost('/notifications/read-all',{});await load()}catch(e){alert(e.friendlyMessage||'Gagal memperbarui notifikasi.')}finally{setBusy(false)}};
 const markRead=async id=>{try{await apiPost(`/notifications/${id}/read`,{});setRows(items=>items.map(item=>item.id===id?{...item,dibaca_pada:new Date().toISOString()}:item))}catch(e){alert(e.friendlyMessage||'Gagal memperbarui notifikasi.')}};
 return <div className="page-container"><div className="page-header"><div><h1>Pusat Notifikasi</h1><p>Notifikasi pembayaran, tagihan, keluhan, dan pekerjaan teknisi.</p></div><Button variant="outline" onClick={markAll} disabled={busy||!rows.some(item=>!item.dibaca_pada)}><CheckCheck size={14}/> Tandai semua dibaca</Button></div><Card><div className="notification-page-list">{rows.length?rows.map(item=><div className={`notification-page-item ${item.dibaca_pada?'read':''}`} key={item.id}><div><div className="notification-page-meta"><Badge variant="info">{labelStatus(item.jenis)}</Badge><span>{formatDateIndo(item.created_at,true)}</span></div><h3>{item.judul}</h3><p>{item.pesan}</p></div><div className="header-actions">{!item.dibaca_pada&&<Button variant="outline" size="sm" onClick={()=>markRead(item.id)}>Tandai dibaca</Button>}{item.tautan&&item.tautan.startsWith('/')&&<Link className="btn btn-secondary btn-sm" to={item.tautan}>Buka</Link>}</div></div>):<div className="empty-state"><strong>Belum ada notifikasi</strong>Notifikasi baru akan muncul di halaman ini.</div>}</div></Card></div>;
}
