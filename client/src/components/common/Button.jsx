import React from 'react';
export default function Button({ children, variant='primary', size='', className='', ...props }) {
  return <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} {...props}>{children}</button>;
}
