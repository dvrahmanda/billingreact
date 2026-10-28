import React,{useEffect,useState} from 'react';
import { apiGet } from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Badge,{statusVariant} from '../../components/common/Badge';
export default function TechnicianMonitoringPage(){const[rows,setRows]=useState([]);useEffect(()=>{apiGet('/technicians').then(r=>setRows(r.data||[]))},[]);
 const cols=[{header:'Teknisi',accessor:r=><div><div className="table-title">{r.nama}</div><div className="table-sub">{r.nomor_whatsapp}</div></div>},{header:'Wilayah',accessor:'wilayah_tugas'},{header:'Status',accessor:r=><Badge variant={statusVariant(r.status)}>{r.status}</Badge>},{header:'Tugas Aktif',accessor:r=>r.active_jobs||0},{header:'Selesai',accessor:r=>r.completed_jobs||0},{header:'Pelanggan Ditangani',accessor:r=>r.current_customer||'-'}];
 return <div className="page-container"><div className="page-header"><div><h1>Monitoring Teknisi</h1><p>Web hanya digunakan admin untuk memonitor pekerjaan. Workflow lapangan Teknisi direncanakan melalui mobile app.</p></div></div><DataTable columns={cols} data={rows}/></div>;}
