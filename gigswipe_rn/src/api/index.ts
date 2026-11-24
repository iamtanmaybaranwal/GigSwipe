import { request } from './client';
import type {
  User, Gig, MyGig, Application, ApplicationWithMeta, ApplicationDetail, Conversation,
  ApplicantWithWorker, HiredApplication, Message, Rating, GigHistoryItem,
  WorkHistoryItem, CreateGigBody, RegisterBody, ProfileUpdate,
} from './types';

export * from './types';
export { ApiError, errorMessage, setAuthToken, getAuthToken, setUnauthorizedHandler } from './client';

const enc = encodeURIComponent;

export const api = {
  auth: {
    register: (data: RegisterBody) =>
      request<{ token: string; user: User }>('POST', '/api/auth/register', data),
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('POST', '/api/auth/login', { email, password }),
    me: () => request<{ user: User }>('GET', '/api/auth/me'),
    updateProfile: (data: ProfileUpdate) =>
      request<{ user: User }>('PUT', '/api/auth/profile', data),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ success: boolean }>('PUT', '/api/auth/password', { currentPassword, newPassword }),
  },

  gigs: {
    feed: () => request<{ gigs: Gig[] }>('GET', '/api/gigs'),
    mine: () => request<{ gigs: MyGig[] }>('GET', '/api/gigs/mine'),
    get: (id: string) => request<{ gig: Gig }>('GET', `/api/gigs/${enc(id)}`),
    create: (data: CreateGigBody) => request<{ gig: Gig }>('POST', '/api/gigs', data),
    remove: (id: string) => request<{ success: boolean }>('DELETE', `/api/gigs/${enc(id)}`),
    history: () => request<{ history: GigHistoryItem[] }>('GET', '/api/gigs/history'),
  },

  users: {
    profile: (userId: string) =>
      request<{ user: User; gigsCompleted: number; workersHired: number }>('GET', `/api/users/${enc(userId)}`),
  },

  applications: {
    apply: (gigId: string) =>
      request<{ application: Application; alreadyApplied?: boolean }>('POST', '/api/applications', { gigId }),
    mine: () => request<{ applications: ApplicationWithMeta[] }>('GET', '/api/applications/mine'),
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

  geo: {
    reverse: (lat: number, lng: number) =>
      request<{ label: string | null }>('GET', `/api/geo/reverse?lat=${lat}&lng=${lng}`),
  },
};
