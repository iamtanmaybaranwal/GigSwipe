import { request } from './client';
import type {
  User, Gig, MyGig, Application, ApplicationDetail, Conversation,
  ApplicantWithWorker, HiredApplication, Message, Rating, GigHistoryItem,
  WorkHistoryItem, CreateGigBody, RegisterBody, ProfileUpdate, UpdateGigBody, FeedFilters,
  GigViewerState, SavedGig, WorkerResult, InviteOption, Invite, InviteWithGig,
} from './types';

export * from './types';
export { ApiError, errorMessage, mediaUrl, setAuthToken, getAuthToken, setUnauthorizedHandler } from './client';

const enc = encodeURIComponent;

/** { a: 1, b: undefined, c: ['x','y'] } → "?a=1&c=x,y" */
function query(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${enc(k)}=${enc(Array.isArray(v) ? v.join(',') : String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const api = {
  auth: {
    register: (data: RegisterBody) =>
      request<{ token: string; user: User }>('POST', '/api/auth/register', data),
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('POST', '/api/auth/login', { email, password }),
    me: () => request<{ user: User }>('GET', '/api/auth/me'),
    updateProfile: (data: ProfileUpdate) =>
      request<{ user: User }>('PUT', '/api/auth/profile', data),
    forgotPassword: (email: string, lang?: string) =>
      request<{ success: boolean; message: string }>('POST', '/api/auth/forgot-password', { email, lang }),
    resetPassword: (email: string, code: string, newPassword: string) =>
      request<{ token: string; user: User }>('POST', '/api/auth/reset-password', { email, code, newPassword }),
    sendEmailCode: (lang?: string) =>
      request<{ success: boolean; alreadyVerified?: boolean }>('POST', '/api/auth/email/send-code', { lang }),
    verifyEmail: (code: string) => request<{ user: User }>('POST', '/api/auth/email/verify', { code }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ success: boolean }>('PUT', '/api/auth/password', { currentPassword, newPassword }),
  },

  gigs: {
    feed: (f: FeedFilters = {}) => request<{ gigs: Gig[] }>('GET', `/api/gigs${query({ ...f })}`),
    mine: () => request<{ gigs: MyGig[] }>('GET', '/api/gigs/mine'),
    get: (id: string) => request<{ gig: Gig; viewer?: GigViewerState }>('GET', `/api/gigs/${enc(id)}`),
    create: (data: CreateGigBody) => request<{ gig: Gig }>('POST', '/api/gigs', data),
    update: (id: string, data: UpdateGigBody) => request<{ gig: Gig }>('PUT', `/api/gigs/${enc(id)}`, data),
    remove: (id: string) => request<{ success: boolean }>('DELETE', `/api/gigs/${enc(id)}`),
    history: () => request<{ history: GigHistoryItem[] }>('GET', '/api/gigs/history'),
  },

  saved: {
    list: () => request<{ gigs: SavedGig[] }>('GET', '/api/saved'),
    add: (gigId: string) => request<{ success: boolean }>('POST', '/api/saved', { gigId }),
    remove: (gigId: string) => request<{ success: boolean }>('DELETE', `/api/saved/${enc(gigId)}`),
  },

  invites: {
    mine: () => request<{ invites: InviteWithGig[] }>('GET', '/api/invites/mine'),
    options: (workerId: string) => request<{ gigs: InviteOption[] }>('GET', `/api/invites/options/${enc(workerId)}`),
    send: (gigId: string, workerId: string, message?: string) =>
      request<{ invite: Invite }>('POST', '/api/invites', { gigId, workerId, message }),
    accept: (id: string) => request<{ invite: Invite; application: Application }>('POST', `/api/invites/${enc(id)}/accept`),
    decline: (id: string) => request<{ invite: Invite }>('POST', `/api/invites/${enc(id)}/decline`),
  },

  uploads: {
    /** Upload a (pre-resized) image; returns its /api/uploads/<id> path. */
    image: (base64: string) =>
      request<{ id: string; url: string }>('POST', '/api/uploads', { data: base64 }, { timeoutMs: 60000 }),
  },

  users: {
    searchWorkers: (p: { q?: string; availableNow?: boolean; slot?: string; radius?: number }) =>
      request<{ workers: WorkerResult[]; hasLocation: boolean }>('GET', `/api/users/workers${query({
        q: p.q, slot: p.slot, radius: p.radius, availableNow: p.availableNow ? 1 : undefined,
      })}`),
    profile: (userId: string) =>
      request<{ user: User; gigsCompleted: number; workersHired: number }>('GET', `/api/users/${enc(userId)}`),
  },

  applications: {
    apply: (gigId: string) =>
      request<{ application: Application; alreadyApplied?: boolean }>('POST', '/api/applications', { gigId }),
    mine: () => request<{ applications: Conversation[] }>('GET', '/api/applications/mine'),
    withdraw: (id: string) => request<{ success: boolean }>('DELETE', `/api/applications/${enc(id)}`),
    inbox: () => request<{ conversations: Conversation[] }>('GET', '/api/applications/inbox'),
    get: (id: string) => request<{ application: ApplicationDetail }>('GET', `/api/applications/${enc(id)}`),
    forGig: (gigId: string) =>
      request<{ applicants: ApplicantWithWorker[] }>('GET', `/api/applications/gig/${enc(gigId)}`),
    hired: () => request<{ applications: HiredApplication[] }>('GET', '/api/applications/hired'),
    sharedWith: (userId: string) =>
      request<{ applications: Application[] }>('GET', `/api/applications/with/${enc(userId)}`),
    workHistory: () => request<{ history: WorkHistoryItem[] }>('GET', '/api/applications/work-history'),
    setStatus: (id: string, status: 'accepted' | 'rejected') =>
      request<{ application: Application }>('PATCH', `/api/applications/${enc(id)}`, { status }),
    hireRequest: (id: string) =>
      request<{ message: string; application: Application }>('POST', `/api/applications/${enc(id)}/hire-request`),
    verifyHire: (id: string, code: string) =>
      request<{ message: string; application: Application }>('POST', `/api/applications/${enc(id)}/verify-hire`, { code }),
  },

  ratings: {
    submit: (data: { applicationId: string; stars: number; review?: string }) =>
      request<{ rating: Rating }>('POST', '/api/ratings', data),
    forUser: (userId: string) =>
      request<{ ratings: Rating[]; averageStars: number; totalRatings: number }>('GET', `/api/ratings/user/${enc(userId)}`),
    given: () => request<{ ratedApplicationIds: string[] }>('GET', '/api/ratings/given'),
  },

  chat: {
    messages: (applicationId: string) =>
      request<{ messages: Message[]; hasMore?: boolean }>('GET', `/api/chat/${enc(applicationId)}`),
    send: (applicationId: string, text: string, clientId?: string) =>
      request<{ message: Message }>('POST', `/api/chat/${enc(applicationId)}/message`, { text, clientId }),
    markRead: (applicationId: string) =>
      request<{ success: boolean }>('POST', `/api/chat/${enc(applicationId)}/read`),
  },

  push: {
    config: () => request<{ webPushPublicKey: string | null; web: boolean; android: boolean }>('GET', '/api/push/config'),
    register: (body: { platform: 'web'; subscription: unknown; lang: string } | { platform: 'android'; token: string; lang: string }) =>
      request<{ success: boolean }>('POST', '/api/push/register', body),
    unregister: (token: string) => request<{ success: boolean }>('POST', '/api/push/unregister', { token }),
  },

  geo: {
    reverse: (lat: number, lng: number) =>
      request<{ label: string | null }>('GET', `/api/geo/reverse?lat=${lat}&lng=${lng}`),
  },
};
