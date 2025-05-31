// components/ModalPortal.tsx
import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Render children into <body>, avoiding re-mounts inside parents */
export default function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;      // SSR guard
  return createPortal(children, document.body);
}