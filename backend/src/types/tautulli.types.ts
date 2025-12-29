/**
 * Tautulli API Types
 * Based on Tautulli API v2 documentation
 */

// Base API Response
export interface TautulliApiResponse<T = any> {
  response: {
    result: 'success' | 'error';
    message: string | null;
    data: T;
  };
}

// User Types
export interface TautulliUser {
  user_id: number;
  username: string;
  friendly_name: string;
  email: string | null;
  thumb: string;
  is_admin: number; // 0 or 1
  is_home_user: number; // 0 or 1
  is_allow_sync: number; // 0 or 1
  is_restricted: number; // 0 or 1
  do_notify: number; // 0 or 1
  keep_history: number; // 0 or 1
  deleted_user: number; // 0 or 1
  allow_guest: number; // 0 or 1
  user_thumb: string;
  filter_all: string;
  filter_movies: string;
  filter_tv: string;
  filter_music: string;
  filter_photos: string;
}

export interface TautulliUsersTable {
  recordsFiltered: number;
  recordsTotal: number;
  draw: number;
  data: TautulliUser[];
}

// History Types
export interface TautulliHistoryRecord {
  date: number; // Unix timestamp
  started: number; // Unix timestamp
  stopped: number; // Unix timestamp
  duration: number; // seconds
  paused_counter: number; // seconds
  user: string;
  user_id: number;
  friendly_name: string;
  platform: string;
  product: string;
  player: string;
  ip_address: string;
  live: number; // 0 or 1
  machine_id: string;
  location: string;
  secure: number; // 0 or 1
  relayed: number; // 0 or 1

  // Media info
  media_type: 'movie' | 'episode' | 'track' | 'photo' | 'clip';
  rating_key: number;
  parent_rating_key: number;
  grandparent_rating_key: number;
  title: string;
  parent_title: string; // Season or Album
  grandparent_title: string; // Show or Artist
  original_title: string;
  year: number;
  media_index: number; // Episode number
  parent_media_index: number; // Season number
  thumb: string;
  parent_thumb: string;
  grandparent_thumb: string;
  art: string;

  // Quality info
  video_decision: string; // direct play, transcode, copy
  audio_decision: string;
  transcode_decision: string;
  quality_profile: string;
  stream_video_resolution: string;
  stream_container: string;
  stream_video_codec: string;
  stream_audio_codec: string;
  stream_bitrate: number;

  // Metadata
  genres: string[];
  labels: string[];
  directors: string[];
  writers: string[];
  actors: string[];
  guid: string;
  summary: string;
  tagline: string;
  rating: number;
  content_rating: string;

  // Progress
  percent_complete: number;
  watched_status: number; // 0 or 1
  group_count: number;
  group_ids: string;

  // State
  state: string | null;
  session_key: string | null;
  reference_id: number;
  row_id: number;
}

export interface TautulliHistory {
  recordsFiltered: number;
  recordsTotal: number;
  draw: number;
  filter_duration: string;
  total_duration: string;
  data: TautulliHistoryRecord[];
}

// User Stats
export interface TautulliUserStats {
  user_id: number;
  total_plays: number;
  total_time: number; // seconds

  // Content type breakdown
  movie_plays: number;
  tv_plays: number;
  music_plays: number;

  // Platform stats
  platform_name: string;
  platform_type: string;
  player_name: string;

  // Last activity
  last_seen: number; // Unix timestamp
  last_played: string;
}

export interface TautulliUserWatchTimeStats {
  query_days: number;
  total_time: number; // seconds
  total_plays: number;

  // By content type
  movie_stats: {
    total_time: number;
    total_plays: number;
  };
  tv_stats: {
    total_time: number;
    total_plays: number;
  };
  music_stats: {
    total_time: number;
    total_plays: number;
  };
}

// Library Stats
export interface TautulliLibrary {
  section_id: number;
  section_name: string;
  section_type: string; // movie, show, artist, photo
  agent: string;
  thumb: string;
  art: string;
  count: number;
  is_active: number;
  parent_count: number;
  child_count: number;
}

export interface TautulliLibraryStats {
  section_id: number;
  section_name: string;
  section_type: string;
  total_plays: number;
  total_duration: number;
  total_items: number;

  // Top items
  most_played: {
    title: string;
    rating_key: number;
    play_count: number;
  }[];
}

// Metadata
export interface TautulliMetadata {
  media_type: 'movie' | 'show' | 'season' | 'episode' | 'artist' | 'album' | 'track';
  section_id: number;
  library_name: string;
  rating_key: number;
  parent_rating_key: number;
  grandparent_rating_key: number;

  title: string;
  sort_title: string;
  original_title: string;
  year: number;
  added_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  last_viewed_at: number; // Unix timestamp

  // Media details
  guid: string;
  studio: string;
  content_rating: string;
  summary: string;
  tagline: string;
  rating: number;
  audience_rating: number;
  user_rating: number;
  duration: number; // milliseconds

  // Images
  thumb: string;
  art: string;
  banner: string;

  // People
  directors: string[];
  writers: string[];
  actors: string[];
  genres: string[];
  labels: string[];
  collections: string[];

  // Episode specific
  media_index: number; // Episode or track number
  parent_media_index: number; // Season or disc number

  // Counts
  play_count: number;

  // Children (for shows/seasons)
  children_count: number;

  // External IDs
  guids: string[];
}

// Server Info
export interface TautulliServerInfo {
  pms_identifier: string;
  pms_name: string;
  pms_version: string;
  pms_platform: string;
  pms_ip: string;
  pms_port: number;
  pms_ssl: number;
  pms_url: string;
  pms_url_manual: number;
}

// Activity
export interface TautulliActivity {
  lan_bandwidth: number;
  wan_bandwidth: number;
  stream_count: number;
  stream_count_direct_play: number;
  stream_count_direct_stream: number;
  stream_count_transcode: number;
  total_bandwidth: number;
  sessions: TautulliSession[];
}

export interface TautulliSession {
  session_key: string;
  session_id: string;
  media_type: string;
  view_offset: number;
  progress_percent: number;
  quality_profile: string;
  bandwidth: number;
  location: string;

  // User info
  user: string;
  user_id: number;
  friendly_name: string;
  user_thumb: string;

  // Player info
  player: string;
  platform: string;
  platform_name: string;
  product: string;

  // Media info
  title: string;
  parent_title: string;
  grandparent_title: string;
  rating_key: number;
  parent_rating_key: number;
  grandparent_rating_key: number;
  thumb: string;
  year: number;
  duration: number;

  // Stream info
  stream_bitrate: number;
  stream_video_resolution: string;
  video_decision: string;
  audio_decision: string;
  transcode_decision: string;
}

// Home Stats (for overview)
export interface TautulliHomeStats {
  rows: Array<{
    stat_id: string;
    stat_title: string;
    rows: number;
    stat_type: string;
    stat: Array<{
      title: string;
      total_plays: number;
      total_duration: number;
      users_watched: number;
      rating_key: number;
      user_thumb: string;
      grandparent_thumb: string;
      thumb: string;
      art: string;
      media_type: string;
      content_rating: string;
      labels: string[];
      year: number;
      started: number;
      row_id: number;
      user: string;
      friendly_name: string;
      platform: string;
    }>;
  }>;
}

// Get Item Watch Time Stats
export interface TautulliItemWatchTimeStats {
  query_days: number[];
  total_time: number;
  total_plays: number;
}

// Search results
export interface TautulliSearchResult {
  value: string; // title
  type: string; // movie, show, episode, etc.
  rating_key: string;
  library_name: string;
  year: string;
  media_index: string;
  parent_media_index: string;
  live: string;
  channel_call_sign: string;
  channel_identifier: string;
}

// Export Options
export interface TautulliHistoryQuery {
  user_id?: number;
  section_id?: number;
  rating_key?: number;
  parent_rating_key?: number;
  grandparent_rating_key?: number;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  media_type?: 'movie' | 'episode' | 'track' | 'live';
  transcode_decision?: 'transcode' | 'copy' | 'direct play';
  guid?: string;
  order_column?: string;
  order_dir?: 'asc' | 'desc';
  start?: number;
  length?: number;
  search?: string;
}
