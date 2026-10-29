import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({ to, label = 'Kembali' }) {
  return (
    <Link className="btn btn-outline page-back-button" to={to} aria-label={label} title={label}>
      <ArrowLeft size={17} />
    </Link>
  );
}
