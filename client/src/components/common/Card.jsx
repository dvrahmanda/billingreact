import React from 'react';
export default function Card({ title, action, children, className='' }) {
  return <section className={`card ${className}`}>
    {(title || action) && <div className="card-header"><div className="card-title">{title}</div>{action}</div>}
    <div className="card-body">{children}</div>
  </section>;
}
