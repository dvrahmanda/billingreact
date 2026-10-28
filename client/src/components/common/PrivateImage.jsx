import React, { useEffect, useState } from 'react';
import api, { privateFileUrl } from '../../services/api';

export default function PrivateImage({ path, alt = '', className, style }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let objectUrl;
    let active = true;
    const url = privateFileUrl(path);
    if (!url) { setSrc(''); return undefined; }
    api.get(url, { responseType: 'blob' }).then(({ data }) => {
      objectUrl = URL.createObjectURL(data);
      if (active) setSrc(objectUrl);
    }).catch(() => { if (active) setSrc(''); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} style={style}/>;
}
