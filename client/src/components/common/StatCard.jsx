import React from 'react';
export default function StatCard({ label, value, meta, icon:Icon, tone='' }) {
  return <div className="card stat-card">
    <div className={`stat-icon ${tone}`}>{Icon ? <Icon size={20}/> : null}</div>
    <div><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{meta && <div className="stat-meta">{meta}</div>}</div>
  </div>;
}
