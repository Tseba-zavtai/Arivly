import React from 'react';
import { Stack } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import WebShell from '@/components/web/WebShell';

const titles: Record<string, string> = {
  index: 'Тусламж ба нөхцөл',
  terms: 'Үйлчилгээний нөхцөл',
  privacy: 'Нууцлалын бодлого',
  contact: 'Холбоо барих',
  sponsored: 'Төлбөртэй үйлчилгээ',
};

export default function WebHelpLayout() {
  return <WebShell>
    <div className="tw-help-content">
      <Stack screenOptions={({ route }) => ({
        header: () => <AppHeader title={titles[route.name] ?? 'Тусламж'} />,
        contentStyle: { backgroundColor: '#fff' },
      })} />
    </div>
  </WebShell>;
}
