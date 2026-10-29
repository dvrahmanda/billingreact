import React,{useEffect,useState} from 'react';
import { Bell, Menu, CheckCheck, ExternalLink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiGet,apiPost } from '../../services/api';
import { formatDateIndo } from '../../utils/formatters';

export default function Topbar({onMenu, mobileOpen}){
 const{user}=useAuth();const navigate=useNavigate();
 const[open,setOpen]=useState(false),[items,setItems]=useState([]),[unread,setUnread]=useState(0);
 const load=()=>apiGet('/notifications?limit=12').then(r=>{setItems(r.data||[]);setUnread(Number(r.unread||0))}).catch(()=>{});
 useEffect(()=>{load();const timer=setInterval(load,60000);return()=>clearInterval(timer)},[]);
 const markRead=async item=>{try{await apiPost(`/notifications/${item.id}/read`,{});setItems(rows=>rows.map(row=>row.id===item.id?{...row,dibaca_pada:new Date().toISOString()}:row));setUnread(n=>Math.max(0,n-1))}catch{}}
 const markAll=async()=>{try{await apiPost('/notifications/read-all',{});setItems(rows=>rows.map(row=>({...row,dibaca_pada:row.dibaca_pada||new Date().toISOString()})));setUnread(0)}catch{}}
 const openItem=async item=>{if(!item.dibaca_pada)await markRead(item);setOpen(false);if(item.tautan?.startsWith('/'))navigate(item.tautan)};
 const initials=(user?.nama_lengkap||user?.username||'A').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();
 return <header className="topbar"><div className="topbar-leading"><button type="button" className="topbar-icon mobile-menu" aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'} aria-expanded={mobileOpen} onClick={onMenu}>{mobileOpen ? <X size={18}/> : <Menu size={18}/>}</button></div>
  <div className="topbar-actions"><div className="notification-wrap"><button className="topbar-icon" aria-label="Notifikasi" onClick={()=>{setOpen(x=>!x);if(!open)load()}}><Bell size={17}/>{unread>0&&<span className="notification-count">{unread>99?'99+':unread}</span>}</button>{open&&<><button className="notification-dismiss" aria-label="Tutup notifikasi" onClick={()=>setOpen(false)}/><div className="notification-panel"><div className="notification-panel-head"><div><strong>Notifikasi</strong><div className="table-sub">{unread} belum dibaca</div></div><button className="btn btn-outline btn-sm" onClick={markAll} disabled={!unread}><CheckCheck size={13}/> Baca semua</button></div><div className="notification-list">{items.length?items.map(item=><button key={item.id} className={`notification-item ${item.dibaca_pada?'read':''}`} onClick={()=>openItem(item)}><span className={`notification-icon type-${item.jenis}`}><Bell size={14}/></span><span className="notification-copy"><strong>{item.judul}</strong><span>{item.pesan}</span><small>{formatDateIndo(item.created_at,true)}</small></span>{item.tautan&&<ExternalLink size={13}/>}</button>):<div className="notification-empty">Belum ada notifikasi.</div>}</div><button className="notification-footer" onClick={()=>{setOpen(false);navigate('/notifications')}}>Lihat semua notifikasi</button></div></>}</div><div className="user-box"><div className="avatar">{initials}</div><div><div className="user-name">{user?.nama_lengkap||user?.username}</div><div className="user-role">{user?.role==='superadmin'?'Super Admin':`Admin Wilayah ${user?.wilayah||''}`}</div></div></div></div>
 </header>;
}
