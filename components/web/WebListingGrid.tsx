import React, { Children, Fragment, type ReactNode } from 'react';
import { BannerCard, useHomeBanners } from './WebBanners';

const LISTINGS_PER_AD = 12;

export default function WebListingGrid({ children, id }: { children: ReactNode; id?: string }) {
  const cards = Children.toArray(children);
  const banners = useHomeBanners(cards.length >= LISTINGS_PER_AD);

  return <div className="tw-listing-grid" id={id}>
    {cards.map((card, index) => {
      const position = index + 1;
      if (position % LISTINGS_PER_AD !== 0 || !banners.length) return card;
      return <Fragment key={React.isValidElement(card) ? card.key : index}>
        {card}
        <aside className="tw-list-ad" aria-label="Сурталчилгаа">
          <span>Сурталчилгаа</span>
          <div className="tw-list-ad-row">
            {banners.map(banner => <BannerCard key={banner.id} banner={banner} />)}
          </div>
        </aside>
      </Fragment>;
    })}
  </div>;
}
