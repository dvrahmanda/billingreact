import React,{useEffect,useState} from 'react';
import { apiGet } from '../../services/api';
import DataTable from '../../components/common/DataTable';
import { formatDateIndo } from '../../utils/formatters';
export default function ActivityPage(){const[rows,setRows]=useState([]);useEffect(()=>{apiGet('/activity').then(r=>setRows(r.data||[]))},[]);
 const cols=[{header:'Waktu',accessor:r=>formatDateIndo(r.created_at,true)},{header:'User',accessor:r=><div><div className="table-title">{r.username}</div><div className="table-sub">{r.role} · {r.wilayah||'-'}</div></div>},{header:'Aktivitas',accessor:'aksi'},{header:'Entitas',accessor:'entitas'},{header:'Rincian',accessor:'rincian'}];
 return <div className="page-container"><div className="page-header"><div><h1>Activity Log</h1><p>Jejak aktivitas penting pada sistem Billing.</p></div></div><DataTable columns={cols} data={rows}/></div>;}
