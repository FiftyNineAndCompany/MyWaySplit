'use client';

import { useEffect } from 'react';
import { initOneSignal, promptAndLockOneSignalDevice, logoutOneSignal } from '@/lib/onesignal';

/**
 * OneSignal Provider — Initializes the SDK and runs mandatory push permission + Device ID locking.
 */
export default function OneSignalProvider({ currentUser }) {
  useEffect(() => {
    // 1. Initialize client-side SDK
    initOneSignal();

    // 2. If authenticated user is present, lock device and prompt permission
    if (currentUser) {
      promptAndLockOneSignalDevice(currentUser);
    } else {
      logoutOneSignal();
    }
  }, [currentUser]);

  return null;
}
