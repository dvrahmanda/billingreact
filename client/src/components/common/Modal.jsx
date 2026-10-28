import React from 'react';
export default function Modal({ title, onClose, children, width=620 }) {
  return <div style={{position:'fixed',inset:0,background:'rgba(5,20,30,.45)',display:'grid',placeItems:'center',zIndex:100,padding:20}} onMouseDown={onClose}>
    <div className="card" style={{width:`min(${width}px,100%)`,maxHeight:'88vh',overflow:'auto'}} onMouseDown={e=>e.stopPropagation()}>
      <div className="card-header"><div className="card-title">{title}</div><button className="btn btn-outline btn-sm" onClick={onClose}>Tutup</button></div>
      {children}
    </div>
  </div>;
}
