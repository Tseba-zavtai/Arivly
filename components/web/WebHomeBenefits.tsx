import React from 'react';
import { Image } from 'expo-image';

const benefits = [
  { image: require('@/assets/home-hints/1.jpg'), title: 'Түрээс илүү ашигтай', description: 'Түрээслүүлсэн нь орлоготой, түрээсэлсэн нь хэмнэлттэй.' },
  { image: require('@/assets/home-hints/2.jpg'), title: 'Хүссэнээ түрээслүүл, түрээслэ', description: 'Өөрт байгаагаа түрээслүүлж, өөрт хэрэгтэйгээ түрээслээрэй.' },
  { image: require('@/assets/home-hints/3.jpg'), title: 'Түрээсээ хялбар удирд', description: 'Түрээсийн өдөр, цагаа харилцан тохиролцож сонгоорой.' },
  { image: require('@/assets/home-hints/4.jpg'), title: 'Өөрт хэрэгтэйгээ ойроосоо', description: 'Өөртөө ойрхон заруудыг газрын зургаас олоорой.' },
  { image: require('@/assets/home-hints/5.jpg'), title: 'Нэмэлт шимтгэлгүй түрээслэ', description: 'Түрээсэлсэн ч, түрээслүүлсэн ч шимтгэлгүйг санаарай.' },
];

export default function WebHomeBenefits() {
  return (
    <section className="tw-home-benefits" aria-label="Arivly-г ашиглахын давуу тал">
      <h2>Arivly-г ашиглахын давуу тал</h2>
      <div className="tw-benefit-cards">
        {benefits.map(({ image, title, description }) => (
          <article className="tw-benefit-card" key={title}>
            <div className="tw-benefit-illustration">
              <Image source={image} style={{ width: '116%', marginLeft: '-8%', aspectRatio: 1064 / 1183 }} contentFit="contain" accessible={false} />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
