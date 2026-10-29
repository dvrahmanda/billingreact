import React,{useEffect,useState} from 'react';
import { apiGet } from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import BackButton from '../../components/common/BackButton';
import { formatRupiah } from '../../utils/formatters';
export default function PaymentMatchingPage(){const[rows,setRows]=useState([]);useEffect(()=>{apiGet('/payments/matching').then(r=>setRows(r.data||[]))},[]);
 const cols=[{header:'Pelanggan',accessor:r=><div><div className="table-title">{r.nama}</div><div className="table-sub">{r.order_id}</div></div>},{header:'Nominal Transaksi',accessor:r=>formatRupiah(r.nominal_dibayar)},{header:'Nominal Tagihan',accessor:r=>formatRupiah(r.nominal_tagihan)},{header:'Status Transaksi',accessor:'status'},{header:'Hasil Pengecekan',accessor:r=><Badge variant={r.result==='Sesuai'?'success':'warning'}>{r.result}</Badge>}];
 return <div className="page-container"><div className="page-header"><div className="page-heading"><BackButton to="/payments" /><div><h1>Pemeriksaan Transaksi Midtrans</h1><p>Memeriksa nominal, transaksi ganda, dan status pembayaran dari Midtrans.</p></div></div></div><DataTable columns={cols} data={rows}/></div>;}
