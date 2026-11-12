import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const labels = {
  members: 'Бүртгэлтэй хэрэглэгч',
  listings: 'Идэвхтэй түрээсийн зар',
  rentals: 'Дууссан түрээс',
};

export default function WebHomeMilestones() {
  const { data } = useQuery({
    queryKey: ['web-home-milestones'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_web_home_milestones');
      return error ? null : data as Partial<Record<keyof typeof labels, number>> | null;
    },
    staleTime: 5 * 60_000,
  });

  if (!data?.members || data.members < 100) return null;
  const milestones = (Object.keys(labels) as (keyof typeof labels)[]).flatMap(key => {
    const amount = data[key];
    return typeof amount === 'number' && amount >= 10 ? [{ key, amount }] : [];
  });
  return <section className="tw-home-milestones" aria-label="Arivly тоогоор">
    {milestones.map(({ key, amount }) => <div key={key}>
      <strong>{amount.toLocaleString('en-US')}+</strong>
      <span>{labels[key]}</span>
    </div>)}
  </section>;
}
