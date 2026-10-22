'use client';

import { useEffect, useRef } from 'react';
import { initOneSignal, loginOneSignal, logoutOneSignal } from '@/lib/onesignal';

/**
 * OneSignal Provider — initializes the SDK and handles user login/logout safely.
 * This is a headless component (renders nothing).
 */
export default function OneSignalProvider({ currentUser }) {
  const previousUserRef = useRef(null);

  useEffect(() => {
    initOneSignal();
  }, []);

  useEffect(() => {
    if (currentUser) {
      previousUserRef.current = currentUser;
      loginOneSignal(currentUser);
    } else if (previousUserRef.current) {
      // Only logout if a user had actively logged in prior
      previousUserRef.current = null;
      logoutOneSignal();
    }
  }, [currentUser]);

  return null; // Headless
}
