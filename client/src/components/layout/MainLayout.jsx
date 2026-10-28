import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
export default function MainLayout(){
  const [open,setOpen]=useState(false);
  return <div className="app-shell">
    <Sidebar open={open} onNavigate={()=>setOpen(false)}/>
    <main className="app-main"><Topbar onMenu={()=>setOpen(v=>!v)}/><div className="app-content"><Outlet/></div></main>
  </div>;
}
