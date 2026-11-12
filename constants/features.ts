import { Platform } from 'react-native';

/**
 * Release switches for features that are already implemented but not ready for
 * public use. Keep the data/schema in place so the feature can be enabled
 * again without a destructive migration.
 */
export const RENTAL_INSURANCE_ENABLED = false;

// iOS uses App Store checkout; Android retains the QPay option.
export const NATIVE_QPAY_ENABLED = Platform.OS === 'android';
