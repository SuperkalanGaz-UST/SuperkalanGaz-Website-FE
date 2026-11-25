'use client';

import { useEffect, useState } from 'react';

export function usePortalContainer(open: boolean): HTMLElement | null {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const portalContainer = document.createElement('div');
    document.body.appendChild(portalContainer);
    setContainer(portalContainer);

    return () => {
      portalContainer.remove();
    };
  }, [open]);

  return container?.isConnected ? container : null;
}
