// Shapes returned by the GigSwipe backend. Keep in sync with backend/src/utils/serialize.ts.

export type Role = 'worker' | 'business';
export type WorkMode = 'onsite' | 'remote';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'hired';

export interface User {
  id: string;
  name: string;
  email?: string; // only present on your own account
  role: Role;
  avatarColor?: string;
  // Business
  businessName?: string;
  industry?: string;
  location?: string;
  website?: string;
  phone?: string;
  // Worker
  university?: string; // shown as "Education"
  major?: string;      // shown as "Profession / field"
  year?: string;       // shown as "Experience"
  skills?: string[];
  sampleWork?: string[];
  // Shared
  bio?: string;
  locationLabel?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusMiles?: number | null;
  createdAt?: string;
}

export interface Gig {
  id: string;
  title: string;
  pay: string;
  hours: string;
  description: string;
  category: string;
  workMode: WorkMode;
  location: string;
  businessId: string;
  businessName: string;
  businessColor: string;
  createdAt: string;
  postedAt: string;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
}

export interface MyGig extends Gig {
  applicantCount: number;
  pendingCount: number;
}

export interface Application {
  id: string;
  gigId: string;
  gigTitle: string;
  workerId: string;
  businessId: string;
  businessName: string;
  businessColor: string;
  status: ApplicationStatus;
  createdAt: string;
  hiredAt?: string;
  hireCodeActive: boolean;
  hireCode?: string;       // only ever sent to the worker
  hireCodeExpiry?: string;
}

export interface ApplicationWithMeta extends Application {
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface ApplicationDetail extends ApplicationWithMeta {
  workerName: string;
  workerColor: string;
}

export interface Conversation extends ApplicationWithMeta {
  otherUser: User | null;
}

export interface ApplicantWithWorker extends Application {
  worker: User | null;
}

export interface HiredApplication extends Application {
  worker: User | null;
  business: User | null;
}

export interface Message {
  id: string;
  applicationId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  text: string;
  timestamp: string;
  clientId?: string;
}

export interface Rating {
  id: string;
  rater: string;
  ratee: string;
  applicationId: string;
  gigTitle: string;
  stars: number;
  review?: string;
  raterRole: Role;
  raterName: string;
  createdAt: string;
}

export interface GigHistoryItem {
  gig: Gig;
  hiredWorkers: User[];
  totalWorkers: number;
}

export interface WorkHistoryItem {
  application: Application;
  business: User | null;
  totalWorkers: number;
  coWorkers: User[];
}

export interface CreateGigBody {
  title: string;
  pay: string;
  hours: string;
  description: string;
  category: string;
  workMode: WorkMode;
  location?: string;
}

export interface RegisterBody {
  name: string;
  email: string;
  password: string;
  role: Role;
  businessName?: string;
  major?: string;
}

export type ProfileUpdate = Partial<Omit<User, 'id' | 'email' | 'role' | 'avatarColor' | 'createdAt'>>;
