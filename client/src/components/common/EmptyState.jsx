import React from 'react';
export default function EmptyState({ title='Belum ada data', description='Data akan tampil di sini ketika tersedia.' }) {
  return <div className="empty-state"><strong>{title}</strong><span>{description}</span></div>;
}
