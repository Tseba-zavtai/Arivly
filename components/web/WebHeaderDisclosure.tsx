import React, { useId, useRef, useState, type ReactNode } from 'react';

export default function WebHeaderDisclosure({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);

  return <div className="tw-header-disclosure"
    onPointerEnter={event => { if (event.pointerType === 'mouse') setOpen(true); }}
    onPointerLeave={event => { if (event.pointerType === 'mouse') setOpen(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }}
  >
    <button ref={trigger} type="button" className="tw-header-pill" aria-expanded={open} aria-controls={panelId}
      onClick={event => setOpen(value => (event.nativeEvent as PointerEvent).pointerType === 'mouse' || !value)}>
      {icon}{label}<span aria-hidden="true">⌄</span>
    </button>
    <div hidden={!open} id={panelId} className="tw-header-dropdown"
      onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}>
      {children}
    </div>
  </div>;
}
