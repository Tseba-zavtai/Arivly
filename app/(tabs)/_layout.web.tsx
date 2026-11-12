import React from 'react';
import { Slot } from 'expo-router';
import WebShell from '@/components/web/WebShell';

export default function WebTabsLayout() {
  return <WebShell><Slot /></WebShell>;
}
