// Shared TypeScript types for the GigSwipe backend.
// When a database is added, these same shapes will map to the DB schema.

export type Role = 'worker' | 'business';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
  // Business fields
  businessName?: string;
  industry?: string;
  location?: string;
  website?: string;
  phone?: string;
  // Worker fields
  university?: string;
  major?: string;
  year?: string;
  skills?: string[];
  bio?: string;
  sampleWork?: string[];
  // Shared: comfortable working range (both roles)
  locationLabel?: string;  // human-readable area, e.g. "Downtown Seattle, WA"
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;    // how far they're willing to travel / hire from
}

export interface Gig {
  id: string;
  title: string;
  pay: string;
  hours: string;
  description: string;
  category: string;
  workMode: 'onsite' | 'remote';
  location: string;
  businessId: string;
  businessName: string;
  businessColor: string;
  createdAt: string;
  postedAt: string;
  // Inherited from the posting business's account at creation time — onsite gigs only
  latitude?: number;
  longitude?: number;
  // Computed per-request when a worker with a set location views the feed
  distanceMiles?: number;
}

// An application is created when a worker swipes right or clicks Apply Now
export interface Application {
  id: string;
  gigId: string;
  gigTitle: string;
  workerId: string;
  businessId: string;
  businessName: string;
  businessColor: string;
  status: 'pending' | 'accepted' | 'rejected' | 'hired';
  createdAt: string;
  hireCode?: string;        // 4-digit code set when business requests hire
  hireCodeExpiry?: string;  // ISO timestamp — code expires after 24 h
}

export interface Message {
  id: string;
  applicationId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  text: string;
  timestamp: string;
}
