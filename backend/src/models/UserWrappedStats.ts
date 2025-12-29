import { db } from '../config/database';
import type { ProcessedStats } from '../processors/stats-calculator';

export interface UserWrappedStats {
  id: number;
  user_id: number;
  generation_id: number | null;
  year: number;

  // Overall stats
  total_watch_time_minutes: number;
  total_plays: number;
  total_movies: number;
  total_tv_episodes: number;
  unique_movies: number;
  unique_shows: number;
  days_active: number;

  // Viewing patterns
  most_active_month: string | null;
  most_active_day_of_week: string | null;
  most_active_hour: number | null;
  longest_streak_days: number;
  longest_binge_minutes: number;
  longest_binge_show: string | null;

  // Top content (JSONB)
  top_movies: any;
  top_shows: any;
  top_episodes: any;
  top_genres: any;
  top_actors: any;
  top_directors: any;

  // Device stats (JSONB)
  top_devices: any;
  top_platforms: any;
  quality_stats: any;
  monthly_stats: any;

  // Sharing stats
  content_shared_with: number;

  // Fun stats
  percentage_of_library_watched: number;
  total_seasons_completed: number;
  rewatches: number;
  first_watch_title: string | null;
  first_watch_date: Date | null;
  last_watch_title: string | null;
  last_watch_date: Date | null;
  most_memorable_day_date: Date | null;
  most_memorable_day_minutes: number;

  // Fun facts and badges (JSONB)
  fun_facts: any;
  badges: any;

  // Raw data cache
  raw_data: any;

  // Metadata
  generated_at: Date;
  is_public: boolean;
  processing_time_seconds: number | null;
}

export interface UserWrappedStatsCreate {
  user_id: number;
  generation_id?: number | null;
  year: number;
  stats: ProcessedStats;
  processing_time_seconds?: number;
}

export class UserWrappedStatsModel {
  static async create(data: UserWrappedStatsCreate): Promise<UserWrappedStats> {
    const stats = data.stats;

    return db.one<UserWrappedStats>(
      `INSERT INTO user_wrapped_stats (
        user_id, generation_id, year,
        total_watch_time_minutes, total_plays, total_movies, total_tv_episodes,
        unique_movies, unique_shows, days_active,
        most_active_month, most_active_day_of_week, most_active_hour,
        longest_streak_days, longest_binge_minutes, longest_binge_show,
        top_movies, top_shows, top_episodes, top_genres, top_actors, top_directors,
        top_devices, top_platforms, quality_stats, monthly_stats,
        content_shared_with, percentage_of_library_watched, total_seasons_completed, rewatches,
        first_watch_title, first_watch_date, last_watch_title, last_watch_date,
        most_memorable_day_date, most_memorable_day_minutes,
        fun_facts, badges, raw_data, processing_time_seconds
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40
      )
      ON CONFLICT (user_id, year) DO UPDATE SET
        generation_id = EXCLUDED.generation_id,
        total_watch_time_minutes = EXCLUDED.total_watch_time_minutes,
        total_plays = EXCLUDED.total_plays,
        total_movies = EXCLUDED.total_movies,
        total_tv_episodes = EXCLUDED.total_tv_episodes,
        unique_movies = EXCLUDED.unique_movies,
        unique_shows = EXCLUDED.unique_shows,
        days_active = EXCLUDED.days_active,
        most_active_month = EXCLUDED.most_active_month,
        most_active_day_of_week = EXCLUDED.most_active_day_of_week,
        most_active_hour = EXCLUDED.most_active_hour,
        longest_streak_days = EXCLUDED.longest_streak_days,
        longest_binge_minutes = EXCLUDED.longest_binge_minutes,
        longest_binge_show = EXCLUDED.longest_binge_show,
        top_movies = EXCLUDED.top_movies,
        top_shows = EXCLUDED.top_shows,
        top_episodes = EXCLUDED.top_episodes,
        top_genres = EXCLUDED.top_genres,
        top_actors = EXCLUDED.top_actors,
        top_directors = EXCLUDED.top_directors,
        top_devices = EXCLUDED.top_devices,
        top_platforms = EXCLUDED.top_platforms,
        quality_stats = EXCLUDED.quality_stats,
        monthly_stats = EXCLUDED.monthly_stats,
        content_shared_with = EXCLUDED.content_shared_with,
        percentage_of_library_watched = EXCLUDED.percentage_of_library_watched,
        total_seasons_completed = EXCLUDED.total_seasons_completed,
        rewatches = EXCLUDED.rewatches,
        first_watch_title = EXCLUDED.first_watch_title,
        first_watch_date = EXCLUDED.first_watch_date,
        last_watch_title = EXCLUDED.last_watch_title,
        last_watch_date = EXCLUDED.last_watch_date,
        most_memorable_day_date = EXCLUDED.most_memorable_day_date,
        most_memorable_day_minutes = EXCLUDED.most_memorable_day_minutes,
        fun_facts = EXCLUDED.fun_facts,
        badges = EXCLUDED.badges,
        raw_data = EXCLUDED.raw_data,
        processing_time_seconds = EXCLUDED.processing_time_seconds,
        generated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        data.user_id,
        data.generation_id || null,
        data.year,
        stats.totalWatchTimeMinutes,
        stats.totalPlays,
        stats.totalMovies,
        stats.totalTvEpisodes,
        stats.uniqueMovies,
        stats.uniqueShows,
        stats.daysActive,
        stats.mostActiveMonth,
        stats.mostActiveDayOfWeek,
        stats.mostActiveHour,
        stats.longestStreakDays,
        stats.longestBingeMinutes,
        stats.longestBingeShow,
        JSON.stringify(stats.topMovies),
        JSON.stringify(stats.topShows),
        JSON.stringify(stats.topEpisodes),
        JSON.stringify(stats.topGenres),
        JSON.stringify(stats.topActors),
        JSON.stringify(stats.topDirectors),
        JSON.stringify(stats.topDevices),
        JSON.stringify(stats.topPlatforms),
        JSON.stringify(stats.qualityStats),
        JSON.stringify(stats.monthlyStats),
        stats.contentSharedWith || 0,
        stats.percentageOfLibraryWatched,
        stats.totalSeasonsCompleted,
        stats.rewatches,
        stats.firstWatchTitle,
        stats.firstWatchDate,
        stats.lastWatchTitle,
        stats.lastWatchDate,
        stats.mostMemorableDayDate,
        stats.mostMemorableDayMinutes,
        JSON.stringify(stats.funFacts),
        JSON.stringify(stats.badges),
        JSON.stringify(stats.overseerrStats || {}),
        data.processing_time_seconds || null,
      ]
    );
  }

  static async findById(id: number): Promise<UserWrappedStats | null> {
    return db.oneOrNone<UserWrappedStats>(
      'SELECT * FROM user_wrapped_stats WHERE id = $1',
      [id]
    );
  }

  static async findByUserAndYear(userId: number, year: number): Promise<UserWrappedStats | null> {
    return db.oneOrNone<UserWrappedStats>(
      'SELECT * FROM user_wrapped_stats WHERE user_id = $1 AND year = $2',
      [userId, year]
    );
  }

  static async findByYear(year: number): Promise<UserWrappedStats[]> {
    return db.manyOrNone<UserWrappedStats>(
      'SELECT * FROM user_wrapped_stats WHERE year = $1 ORDER BY total_watch_time_minutes DESC',
      [year]
    );
  }

  static async findByGeneration(generationId: number): Promise<UserWrappedStats[]> {
    return db.manyOrNone<UserWrappedStats>(
      'SELECT * FROM user_wrapped_stats WHERE generation_id = $1',
      [generationId]
    );
  }

  static async setPublic(id: number, isPublic: boolean): Promise<void> {
    await db.none('UPDATE user_wrapped_stats SET is_public = $1 WHERE id = $2', [isPublic, id]);
  }

  static async countByYear(year: number): Promise<number> {
    const result = await db.one<{ count: string }>(
      'SELECT COUNT(*) FROM user_wrapped_stats WHERE year = $1',
      [year]
    );
    return parseInt(result.count, 10);
  }

  static async delete(id: number): Promise<boolean> {
    const result = await db.result('DELETE FROM user_wrapped_stats WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  static async deleteByUserAndYear(userId: number, year: number): Promise<boolean> {
    const result = await db.result(
      'DELETE FROM user_wrapped_stats WHERE user_id = $1 AND year = $2',
      [userId, year]
    );
    return result.rowCount > 0;
  }
}

export default UserWrappedStatsModel;
