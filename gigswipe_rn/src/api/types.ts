// Shapes returned by the GigSwipe backend. Keep in sync with backend/src/utils/serialize.ts.

export type Role = 'worker' | 'business';
export type WorkMode = 'onsite' | 'remote';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'hired';
export type PayUnit = 'hour' | 'day' | 'week' | 'month' | 'fixed';
export type GigStatus = 'open' | 'filled' | 'closed';
export type AvailabilitySlot =
  'weekday_mornings' | 'weekday_afternoons' | 'weekday_evenings' | 'weekends' | 'nights' | 'flexible';

export interface User {
  id: string;
  name: string;
  email?: string; // only present on your own account
  emailVerified?: boolean;
  role: Role;
  avatarColor?: string;
  photoUrl?: string; // /api/uploads/<id>
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
  availability?: AvailabilitySlot[];
  availabilityNote?: string;
  availableUntil?: string;
  availableNow?: boolean;
  discoverable?: boolean;
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
  payAmount?: number;
  payUnit?: PayUnit;
  hours: string; // schedule notes
  startAt?: string;
  endAt?: string;
  openings: number;
  hiredCount: number;
  spotsLeft: number;
  status: GigStatus;
  expired: boolean;
  photos: string[];
  businessPhotoUrl?: string;
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

export interface SavedGig extends Gig {
  savedAt: string;
  applied: boolean;
}

export interface GigViewerState {
  saved: boolean;
  applicationId: string | null;
}

export interface FeedFilters {
  q?: string;
  category?: string[];
  mode?: WorkMode;
  payUnit?: PayUnit;
  minPay?: number;
  from?: string;
  to?: string;
  radius?: number;
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

export interface GigSchedule {
  gigStartAt?: string;
  gigEndAt?: string;
  gigLocation?: string;
  gigLatitude?: number;
  gigLongitude?: number;
  gigStatus?: GigStatus;
  gigRemoved?: boolean;
}

export interface ApplicationWithMeta extends Application, GigSchedule {
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface ApplicationDetail extends ApplicationWithMeta {
  workerName: string;
  workerColor: string;
  workerPhotoUrl?: string;
  businessPhotoUrl?: string;
}

export interface Conversation extends ApplicationWithMeta {
  otherUser: User | null;
}

export interface WorkerResult extends User {
  distanceMiles?: number;
  averageStars: number;
  totalRatings: number;
  gigsCompleted: number;
}

export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface Invite {
  id: string;
  gigId: string;
  businessId: string;
  workerId: string;
  message?: string;
  status: InviteStatus;
  applicationId?: string;
  createdAt: string;
}

export interface InviteWithGig extends Invite {
  gig: Gig;
  business: User | null;
}

export interface InviteOption {
  gig: Gig;
  state: 'none' | 'applied' | 'invite_pending' | 'invite_accepted' | 'invite_declined';
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
  payAmount: number;
  payUnit: PayUnit;
  pay?: string;
  hours?: string;
  description: string;
  category: string;
  workMode: WorkMode;
  location?: string;
  startAt?: string | null;
  endAt?: string | null;
  openings?: number;
  photos?: string[];
}

export type UpdateGigBody = Partial<CreateGigBody> & { status?: 'open' | 'closed' };

export interface RegisterBody {
  name: string;
  email: string;
  password: string;
  role: Role;
  businessName?: string;
  major?: string;
}

export type ProfileUpdate = Partial<Omit<User,
  'id' | 'email' | 'role' | 'avatarColor' | 'createdAt' | 'availableNow' | 'photoUrl' | 'availableUntil'>> & {
  photoUrl?: string | null;
  availableUntil?: string | null;
};
