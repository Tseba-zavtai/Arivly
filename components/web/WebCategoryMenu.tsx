import React, { useId, useRef, useState } from 'react';
import type { CatalogCategory, CatalogSubcategory } from '@/lib/categoryCatalog';

export default function WebCategoryMenu({ categories, selected, onSelect }: {
  categories: CatalogCategory[];
  selected: string;
  onSelect: (name: string, subcategory?: CatalogSubcategory) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const panelId = useId();
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const category = categories.find(item => item.id === active);
  const choose = (name: string, subcategory?: CatalogSubcategory) => {
    setActive(null);
    onSelect(name, subcategory);
  };

  return <nav className="tw-category-menu" aria-label="Түрээсийн ангилал"
    onPointerLeave={event => { if (event.pointerType === 'mouse') setActive(null); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(null); }}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        setActive(null);
        lastTrigger.current?.focus();
      }
    }}
  >
    <div className="tw-category-bar">
      {[{ id: '', name: '☰ Бүх ангилал' }, ...categories.slice(0, 7)].map(item =>
        <button type="button" key={item.id} aria-expanded={active === item.id} aria-controls={panelId}
          className={active === item.id || (item.id && selected === item.name) ? 'is-active' : ''}
          onPointerEnter={event => {
            if (event.pointerType === 'mouse') {
              lastTrigger.current = event.currentTarget;
              setActive(item.id);
            }
          }}
          onClick={event => {
            lastTrigger.current = event.currentTarget;
            setActive(previous => (event.nativeEvent as PointerEvent).pointerType !== 'mouse' && previous === item.id ? null : item.id);
          }}>{item.name}</button>
      )}
    </div>
    <div className="tw-category-panel" id={panelId} hidden={active === null}>
      <strong>{category?.name ?? 'Бүх ангилал'}</strong>
      <div className="tw-category-panel-links">
        <button type="button" onClick={() => choose(category?.name ?? '')}>Бүх зар харах ↗</button>
        {category
          ? category.subcategories.map(sub => <button type="button" key={sub.id} onClick={() => choose(category.name, sub)}>{sub.name}</button>)
          : categories.map(item => <button type="button" key={item.id} onClick={() => choose(item.name)}>{item.name}</button>)}
      </div>
    </div>
  </nav>;
}
