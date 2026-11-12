import React, { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import WebListingGrid from './WebListingGrid';

export default function WebHomeRail({ title, subtitle, wide = false, threeUp = false, hideTitle = false, allItems, children }: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  threeUp?: boolean;
  hideTitle?: boolean;
  allItems?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  const trackId = useId();
  const track = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState({ previous: false, next: false });

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => {
      const previous = element.scrollLeft > 2;
      const next = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
      setPosition(current => current.previous === previous && current.next === next ? current : { previous, next });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    Array.from(element.children).forEach(child => observer.observe(child));
    element.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [children, expanded]);

  const move = (direction: number) => {
    const element = track.current;
    const first = element?.firstElementChild;
    if (!element || !first) return;
    const start = first.getBoundingClientRect().left;
    const max = element.scrollWidth - element.clientWidth;
    const positions = Array.from(element.children, card => Math.min(max, card.getBoundingClientRect().left - start));
    const current = element.scrollLeft;
    const next = direction > 0
      ? positions.find(left => left > current + 2) ?? max
      : positions.reverse().find(left => left < current - 2) ?? 0;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    element.scrollTo({ left: next, behavior });
  };
  const arrows = !expanded && (position.previous || position.next) && <div className="tw-rail-controls">
    <button type="button" disabled={!position.previous} aria-label={`${title} · өмнөх`} aria-controls={trackId} onClick={() => move(-1)}>←</button>
    <button type="button" disabled={!position.next} aria-label={`${title} · дараах`} aria-controls={trackId} onClick={() => move(1)}>→</button>
  </div>;

  return (
    <section className={`tw-section tw-home-rail${hideTitle ? ' tw-untitled-rail' : ''}`}
      aria-labelledby={hideTitle ? undefined : headingId} aria-label={hideTitle ? title : undefined}>
      {hideTitle && arrows && <div className="tw-untitled-controls">{arrows}</div>}
      {!hideTitle && (
      <div className="tw-section-heading">
        <div><h2 id={headingId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <div className="tw-rail-actions">
          {allItems && <button type="button" className="tw-text-button" ref={toggle}
            aria-expanded={expanded} aria-controls={trackId} onClick={() => setExpanded(value => !value)}>
            {expanded ? 'Хураах ↑' : 'Бүгдийг харах ›'}
          </button>}
          {arrows}
        </div>
      </div>
      )}
      {expanded ? <WebListingGrid id={trackId}>{allItems}</WebListingGrid> :
      <div className={`tw-rail-track${wide ? ' tw-rail-wide' : ''}${threeUp ? ' tw-rail-three-up' : ''}`} id={trackId} ref={track}
        tabIndex={hideTitle ? 0 : undefined} aria-label={hideTitle ? title : undefined}>
        {children}
        {allItems && <button type="button" className="tw-rail-view-all" aria-controls={trackId} onClick={() => {
          toggle.current?.focus();
          setExpanded(true);
        }}><span aria-hidden="true">→</span>Бүгдийг харах</button>}
      </div>}
    </section>
  );
}
