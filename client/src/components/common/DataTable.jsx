import React from 'react';
export default function DataTable({ columns=[], data=[], loading=false, emptyText='Data belum tersedia.' }) {
  if (loading) return <div className="card empty-state"><div className="spinner" style={{margin:'0 auto 10px'}}/><strong>Memuat data...</strong></div>;
  return <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map((c,i)=><th key={i}>{c.header}</th>)}</tr></thead>
    <tbody>{data.length ? data.map((row,ri)=><tr key={row.id ?? ri}>{columns.map((c,ci)=><td key={ci}>{typeof c.accessor==='function'?c.accessor(row):row[c.accessor] ?? '-'}</td>)}</tr>) :
      <tr><td colSpan={columns.length}><div className="empty-state"><strong>Belum ada data</strong>{emptyText}</div></td></tr>}</tbody></table></div>;
}
