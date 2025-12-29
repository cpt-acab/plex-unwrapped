/**
 * Overseerr API Types
 * Based on Overseerr API documentation
 */

// Paginated Response
export interface OverseerrPaginatedResponse<T> {
  pageInfo: {
    pages: number;
    pageSize: number;
    results: number;
    page: number;
  };
  results: T[];
}

// User Types
export interface OverseerrUser {
  id: number;
  email: string;
  username?: string;
  plexToken?: string;
  plexUsername?: string;
  userType: number; // 1 = Plex, 2 = Local
  permissions: number;
  avatar: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  requestCount: number;
  displayName: string;
}

export interface OverseerrUserSettings {
  username?: string;
  discordId?: string;
  locale?: string;
  region?: string;
  originalLanguage?: string;
  telegramChatId?: string;
  telegramSendSilently?: boolean;
  pgpKey?: string;
  notificationTypes?: {
    discord?: number;
    email?: number;
    pushbullet?: number;
    pushover?: number;
    slack?: number;
    telegram?: number;
    webhook?: number;
    webpush?: number;
  };
}

// Request Types
export enum MediaType {
  MOVIE = 'movie',
  TV = 'tv',
}

export enum MediaStatus {
  UNKNOWN = 1,
  PENDING = 2,
  PROCESSING = 3,
  PARTIALLY_AVAILABLE = 4,
  AVAILABLE = 5,
}

export enum MediaRequestStatus {
  PENDING = 1,
  APPROVED = 2,
  DECLINED = 3,
}

export interface OverseerrMediaRequest {
  id: number;
  status: MediaRequestStatus;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  type: MediaType;
  is4k: boolean;
  serverId: number;
  profileId: number;
  rootFolder: string;

  media: {
    id: number;
    tmdbId: number;
    tvdbId?: number;
    status: MediaStatus;
    mediaType: MediaType;
    serviceId?: number;
    externalServiceId?: number;
    externalServiceSlug?: string;
  };

  requestedBy: OverseerrUser;
  modifiedBy?: OverseerrUser;

  // Movie specific
  movie?: {
    id: number;
    title: string;
    originalTitle?: string;
    overview?: string;
    releaseDate?: string;
    posterPath?: string;
    backdropPath?: string;
    voteAverage?: number;
    voteCount?: number;
    genres?: { id: number; name: string }[];
    runtime?: number;
  };

  // TV specific
  tv?: {
    id: number;
    name: string;
    originalName?: string;
    overview?: string;
    firstAirDate?: string;
    posterPath?: string;
    backdropPath?: string;
    voteAverage?: number;
    voteCount?: number;
    genres?: { id: number; name: string }[];
    numberOfSeasons?: number;
    numberOfEpisodes?: number;
  };

  seasons?: {
    id: number;
    seasonNumber: number;
    status: MediaStatus;
  }[];
}

export interface OverseerrRequest {
  id: number;
  status: MediaRequestStatus;
  createdAt: string;
  updatedAt: string;
  type: MediaType;
  is4k: boolean;

  media: {
    id: number;
    tmdbId: number;
    tvdbId?: number;
    status: MediaStatus;
    requests: OverseerrMediaRequest[];
    createdAt: string;
    updatedAt: string;
    lastSeasonChange?: string;
    mediaType: MediaType;
    serviceId?: number;
    serviceUrl?: string;
    downloadStatus?: any[];
    plexUrl?: string;
    serviceUrl4k?: string;
    plexUrl4k?: string;
  };

  requestedBy: OverseerrUser;
  modifiedBy?: OverseerrUser;

  // Seasons (for TV shows)
  seasons: {
    id: number;
    seasonNumber: number;
    status: number;
    createdAt: string;
    updatedAt: string;
  }[];

  // Media info
  title?: string;
  posterPath?: string;
  releaseDate?: string;

  // Movie specific (for easier access to media info)
  movie?: {
    id: number;
    title: string;
    originalTitle?: string;
    overview?: string;
    releaseDate?: string;
    posterPath?: string;
    backdropPath?: string;
    voteAverage?: number;
    voteCount?: number;
    genres?: { id: number; name: string }[];
    runtime?: number;
  };

  // TV specific (for easier access to media info)
  tv?: {
    id: number;
    name: string;
    originalName?: string;
    overview?: string;
    firstAirDate?: string;
    posterPath?: string;
    backdropPath?: string;
    voteAverage?: number;
    voteCount?: number;
    genres?: { id: number; name: string }[];
    numberOfSeasons?: number;
    numberOfEpisodes?: number;
  };
}

// Media Types
export interface OverseerrMovie {
  id: number;
  adult: boolean;
  backdropPath?: string;
  budget: number;
  genres: { id: number; name: string }[];
  homepage?: string;
  imdbId?: string;
  originalLanguage: string;
  originalTitle: string;
  overview?: string;
  popularity: number;
  posterPath?: string;
  releaseDate: string;
  revenue: number;
  runtime?: number;
  status: string;
  tagline?: string;
  title: string;
  video: boolean;
  voteAverage: number;
  voteCount: number;
  credits: {
    cast: OverseerrCast[];
    crew: OverseerrCrew[];
  };
  mediaInfo?: {
    id: number;
    tmdbId: number;
    tvdbId?: number;
    status: MediaStatus;
    requests: OverseerrMediaRequest[];
    createdAt: string;
    updatedAt: string;
  };
}

export interface OverseerrTVShow {
  id: number;
  backdropPath?: string;
  firstAirDate: string;
  genres: { id: number; name: string }[];
  homepage?: string;
  name: string;
  originalName: string;
  overview?: string;
  popularity: number;
  posterPath?: string;
  voteAverage: number;
  voteCount: number;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  status: string;
  type: string;
  credits: {
    cast: OverseerrCast[];
    crew: OverseerrCrew[];
  };
  seasons: OverseerrSeason[];
  mediaInfo?: {
    id: number;
    tmdbId: number;
    tvdbId?: number;
    status: MediaStatus;
    requests: OverseerrMediaRequest[];
    seasons: {
      id: number;
      seasonNumber: number;
      status: MediaStatus;
    }[];
    createdAt: string;
    updatedAt: string;
  };
}

export interface OverseerrSeason {
  id: number;
  airDate?: string;
  episodeCount: number;
  name: string;
  overview?: string;
  posterPath?: string;
  seasonNumber: number;
}

export interface OverseerrCast {
  id: number;
  castId: number;
  character: string;
  creditId: string;
  gender: number;
  name: string;
  order: number;
  profilePath?: string;
}

export interface OverseerrCrew {
  id: number;
  creditId: string;
  department: string;
  gender: number;
  job: string;
  name: string;
  profilePath?: string;
}

// Statistics
export interface OverseerrStats {
  totalRequests: number;
  totalMediaItems: number;
  moviesRequests: number;
  tvRequests: number;
  totalUsers: number;
}

// Settings
export interface OverseerrSettings {
  id: number;
  applicationTitle: string;
  applicationUrl: string;
  csrfProtection: boolean;
  hideAvailable: boolean;
  localLogin: boolean;
  newPlexLogin: boolean;
  region: string;
  originalLanguage: string;
  trustProxy: boolean;
  partialRequestsEnabled: boolean;
  defaultPermissions: number;
}

// Status
export interface OverseerrStatus {
  version: string;
  commitTag: string;
  updateAvailable: boolean;
  commitsBehind: number;
}

// Query Options for Requests
export interface OverseerrRequestQuery {
  take?: number;
  skip?: number;
  filter?: 'all' | 'approved' | 'available' | 'pending' | 'processing' | 'unavailable';
  sort?: 'added' | 'modified';
  requestedBy?: number;
}

// User Request Stats (custom aggregation)
export interface OverseerrUserRequestStats {
  userId: number;
  totalRequests: number;
  movieRequests: number;
  tvRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  declinedRequests: number;
  availableRequests: number;

  // Timing stats
  averageApprovalTimeHours?: number;
  fastestApprovalTimeHours?: number;
  slowestApprovalTimeHours?: number;

  // Request breakdown by month
  requestsByMonth?: {
    month: string; // YYYY-MM
    count: number;
  }[];

  // Most requested genres
  topGenres?: {
    genre: string;
    count: number;
  }[];

  // Top requested media
  topRequests?: {
    title: string;
    type: MediaType;
    status: MediaStatus;
    requestedAt: string;
    tmdbId: number;
    posterPath?: string;
  }[];
}

// Issue Types
export interface OverseerrIssue {
  id: number;
  issueType: number; // 1 = Video, 2 = Audio, 3 = Subtitles, 4 = Other
  status: number; // 1 = Open, 2 = Resolved
  createdAt: string;
  updatedAt: string;
  media: {
    id: number;
    tmdbId: number;
    mediaType: MediaType;
    status: MediaStatus;
  };
  createdBy: OverseerrUser;
  comments?: {
    id: number;
    message: string;
    createdAt: string;
    user: OverseerrUser;
  }[];
}

// Quotas
export interface OverseerrQuota {
  id: string;
  quotaLimit?: number;
  quotaDays?: number;
  quotaUsed?: number;
}
