import React,{useEffect,useState} from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '../../services/api';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge,{statusVariant} from '../../components/common/Badge';
import { formatRupiah,formatDateIndo } from '../../utils/formatters';
export default function BillDetailPage(){const {id}=useParams();const [d,setD]=useState(null);useEffect(()=>{apiGet(`/billings/${id}`).then(r=>setD(r.data))},[id]);if(!d)return <div className="screen-center" style={{minHeight:350}}><div className="spinner"/></div>;
 return <div className="page-container"><div className="page-header"><div><h1>Detail Tagihan</h1><p>{d.nomor_invoice||`INV-${d.id}`}</p></div><div className="header-actions"><Badge variant={statusVariant(d.status_bayar)}>{d.status_bayar}</Badge><Button variant="outline" onClick={()=>window.print()}>Cetak Invoice / PDF</Button></div></div><Card><div className="invoice-heading"><div><strong>Life Media Internet</strong><div className="table-sub">PT Sarana Insan Muda Selaras</div></div><div className="invoice-number">{d.nomor_invoice||`INV-${d.id}`}</div></div><div className="info-grid">{[['Pelanggan',d.nama_snapshot||d.nama],['ID Pelanggan',d.id_pelanggan_snapshot||d.id_pelanggan],['Wilayah',d.alamat_snapshot||d.alamat],['Periode',formatDateIndo(d.periode)],['Nominal',formatRupiah(d.nominal_tagihan)],['Jatuh Tempo',formatDateIndo(d.tanggal_jatuh_tempo)],['Tanggal Bayar',formatDateIndo(d.tanggal_bayar,true)],['Metode',d.metode_pembayaran||'-']].map(([l,v])=><div className="info-item" key={l}><div className="info-label">{l}</div><div className="info-value">{v||'-'}</div></div>)}</div></Card></div>;
}
