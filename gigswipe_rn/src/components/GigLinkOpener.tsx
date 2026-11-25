// Opens the gig from a tapped "new gig near you" notification
// (Android: launch intent; web: ?gig= link or a message from the service worker).
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/ref';
import { consumePendingGigId, onOpenGig } from '../services/push';

let waiting: string | null = null;

function open(gigId: string) {
  if (navigationRef.isReady()) navigationRef.navigate('GigDetail', { gigId });
  else waiting = gigId;
}

export function GigLinkOpener() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'signedIn') return;
    const check = () => {
      const id = consumePendingGigId() ?? waiting;
      waiting = null;
      if (id) setTimeout(() => open(id), 300); // let the tabs mount first
    };
    check();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') check(); });
    const off = onOpenGig(id => open(id));
    return () => { sub.remove(); off(); };
  }, [status]);

  return null;
}
