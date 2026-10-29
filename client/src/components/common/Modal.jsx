import React from 'react';
import { X } from 'lucide-react';
export default function Modal({ title, onClose, children, width=620, showCloseButton=true }) {
  return <div style={{position:'fixed',inset:0,background:'rgba(31,38,32,.42)',display:'grid',placeItems:'center',zIndex:100,padding:20}} onMouseDown={onClose}>
    <div className="card" style={{width:`min(${width}px,100%)`,maxHeight:'88vh',overflow:'auto'}} onMouseDown={e=>e.stopPropagation()}>
      <div className="card-header"><div className="card-title">{title}</div>{showCloseButton&&<button type="button" className="modal-close-button" onClick={onClose} aria-label="Tutup dialog" title="Tutup"><X size={18}/></button>}</div>
      {children}
    </div>
  </div>;
}
