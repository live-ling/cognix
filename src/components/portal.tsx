import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Renders children into document.body to avoid parent CSS containment issues */
export function Portal({ children }: { children: React.ReactNode }) {
  const [el] = useState(() => document.createElement('div'));

  useEffect(() => {
    document.body.appendChild(el);
    return () => { document.body.removeChild(el); };
  }, [el]);

  return createPortal(children, el);
}
