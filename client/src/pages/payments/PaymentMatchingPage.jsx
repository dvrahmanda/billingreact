import React,{useEffect,useState} from 'react';
import { apiGet } from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import { formatRupiah } from '../../utils/formatters';
export default function PaymentMatchingPage(){const[rows,setRows]=useState([]);useEffect(()=>{apiGet('/payments/matching').then(r=>setRows(r.data||[]))},[]);
 const cols=[{header:'Pelanggan',accessor:r=><div><div className="table-title">{r.nama}</div><div className="table-sub">{r.order_id}</div></div>},{header:'Nominal Transaksi',accessor:r=>formatRupiah(r.nominal_dibayar)},{header:'Nominal Tagihan',accessor:r=>formatRupiah(r.nominal_tagihan)},{header:'Status Transaksi',accessor:'status'},{header:'Hasil Pengecekan',accessor:r=><Badge variant={r.result==='Sesuai'?'success':'warning'}>{r.result}</Badge>}];
 return <div className="page-container"><div className="page-header"><div><h1>Pengecekan dan Pencocokan Pembayaran</h1><p>Mendeteksi nominal tidak sesuai, transaksi ganda, dan status yang perlu diperiksa.</p></div></div><DataTable columns={cols} data={rows}/></div>;}
