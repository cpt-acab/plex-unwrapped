import { format, parse, differenceInDays } from 'date-fns';
import logger from '../utils/logger';
import { getTautulliService } from '../services/tautulli.service';
import { getOverseerrService } from '../services/overseerr.service';
import type { TautulliHistoryRecord, TautulliMetadata } from '../types/tautulli.types';
import type { OverseerrUserRequestStats } from '../types/overseerr.types';

export interface ProcessedStats {
  // Basic stats
  totalWatchTimeMinutes: number;
  totalPlays: number;
  totalMovies: number;
  totalTvEpisodes: number;
  uniqueMovies: number;
  uniqueShows: number;
  daysActive: number;

  // Viewing patterns
  mostActiveMonth: string;
  mostActiveDayOfWeek: string;
  mostActiveHour: number;
  longestStreakDays: number;
  longestBingeMinutes: number;
  longestBingeShow: string | null;

  // Top content
  topMovies: TopMovie[];
  topShows: TopShow[];
  topEpisodes: TopEpisode[];
  topGenres: TopGenre[];
  topActors: TopPerson[];
  topDirectors: TopPerson[];

  // Device stats
  topDevices: DeviceStat[];
  topPlatforms: PlatformStat[];
  qualityStats: QualityStats;

  // Monthly breakdown
  monthlyStats: MonthlyStat[];
  contentSharedWith: number;

  // Fun stats
  percentageOfLibraryWatched: number;
  totalSeasonsCompleted: number;
  rewatches: number;
  firstWatchTitle: string | null;
  firstWatchDate: Date | null;
  lastWatchTitle: string | null;
  lastWatchDate: Date | null;
  mostMemorableDayDate: Date | null;
  mostMemorableDayMinutes: number;

  // Fun facts and badges
  funFacts: string[];
  badges: Badge[];

  // Overseerr stats (if available)
  overseerrStats?: OverseerrUserRequestStats;
}

export interface TopMovie {
  title: string;
  year: number;
  plays: number;
  durationMinutes: number;
  thumb: string;
  ratingKey: number;
  genres?: string[];
}

export interface TopShow {
  title: string;
  plays: number;
  episodes: number;
  durationMinutes: number;
  thumb: string;
  ratingKey: number;
  seasonsCompleted?: number;
  genres?: string[];
}

export interface TopEpisode {
  title: string;
  show: string;
  season: number;
  episode: number;
  plays: number;
  thumb: string;
}

export interface TopGenre {
  genre: string;
  count: number;
  minutes: number;
  percentage: number;
}

export interface TopPerson {
  name: string;
  count: number;
  titles: string[];
}

export interface DeviceStat {
  device: string;
  platform: string;
  plays: number;
  minutes: number;
}

export interface PlatformStat {
  platform: string;
  plays: number;
  minutes: number;
}

export interface QualityStats {
  directPlay: number;
  transcode: number;
  directStream: number;
  resolutions: Record<string, number>;
}

export interface MonthlyStat {
  month: string;
  monthName: string;
  plays: number;
  minutes: number;
}

export interface Badge {
  name: string;
  description: string;
  icon: string;
}

export class StatsCalculator {
  private tautulli = getTautulliService();
  private overseerr = getOverseerrService();

  /**
   * Calculate all wrapped stats for a user for a specific year
   */
  async calculateUserStats(userId: number, year: number): Promise<ProcessedStats> {
    logger.info(`Calculating stats for user ${userId} for year ${year}`);

    const startTime = Date.now();

    // Fetch all history for the year
    const history = await this.tautulli.getAllHistoryForYear(userId, year);

    if (history.length === 0) {
      logger.warn(`No history found for user ${userId} in year ${year}`);
      return this.getEmptyStats();
    }

    // Calculate all stats
    const basicStats = this.calculateBasicStats(history);
    const viewingPatterns = this.calculateViewingPatterns(history);
    const topContent = await this.calculateTopContent(history);
    const topGenres = this.calculateTopGenres(history);
    const topPeople = await this.calculateTopPeople(history);
    const deviceStats = this.calculateDeviceStats(history);
    const monthlyStats = this.calculateMonthlyStats(history);
    const funStats = this.calculateFunStats(history);

    // Get Overseerr stats if enabled
    let overseerrStats: OverseerrUserRequestStats | undefined;
    if (this.overseerr.isEnabled()) {
      try {
        overseerrStats = await this.overseerr.getUserRequestStats(userId, year);
      } catch (error: any) {
        logger.error('Failed to get Overseerr stats:', error);
      }
    }

    // Generate fun facts and badges
    const funFacts = this.generateFunFacts(history, basicStats, viewingPatterns, overseerrStats);
    const badges = this.generateBadges(history, basicStats, viewingPatterns, overseerrStats);

    const duration = Date.now() - startTime;
    logger.info(`Stats calculation completed in ${duration}ms for user ${userId}`);

    return {
      ...basicStats,
      ...viewingPatterns,
      ...topContent,
      topGenres,
      ...topPeople,
      ...deviceStats,
      monthlyStats,
      contentSharedWith: 0,
      ...funStats,
      funFacts,
      badges,
      overseerrStats,
    };
  }

  /**
   * Calculate basic statistics
   */
  private calculateBasicStats(history: TautulliHistoryRecord[]) {
    const totalWatchTimeMinutes = Math.round(
      history.reduce((sum, record) => sum + record.duration / 60, 0)
    );

    const totalPlays = history.length;

    const movies = history.filter((r) => r.media_type === 'movie');
    const episodes = history.filter((r) => r.media_type === 'episode');

    const uniqueMovies = new Set(movies.map((r) => r.rating_key)).size;
    const uniqueShows = new Set(episodes.map((r) => r.grandparent_rating_key)).size;

    // Count unique days with activity
    const uniqueDays = new Set(
      history.map((r) => format(new Date(r.started * 1000), 'yyyy-MM-dd'))
    ).size;

    return {
      totalWatchTimeMinutes,
      totalPlays,
      totalMovies: movies.length,
      totalTvEpisodes: episodes.length,
      uniqueMovies,
      uniqueShows,
      daysActive: uniqueDays,
    };
  }

  /**
   * Calculate viewing patterns
   */
  private calculateViewingPatterns(history: TautulliHistoryRecord[]) {
    // Most active month
    const monthCounts: Record<string, number> = {};
    history.forEach((r) => {
      const month = format(new Date(r.started * 1000), 'MMMM');
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const mostActiveMonth =
      Object.entries(monthCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'January';

    // Most active day of week
    const dayOfWeekCounts: Record<string, number> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    history.forEach((r) => {
      const day = dayNames[new Date(r.started * 1000).getDay()];
      dayOfWeekCounts[day] = (dayOfWeekCounts[day] || 0) + 1;
    });
    const mostActiveDayOfWeek =
      Object.entries(dayOfWeekCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Saturday';

    // Most active hour
    const hourCounts: Record<number, number> = {};
    history.forEach((r) => {
      const hour = new Date(r.started * 1000).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const mostActiveHour =
      parseInt(Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || '20', 10);

    // Longest streak (consecutive days)
    const sortedDays = Array.from(
      new Set(history.map((r) => format(new Date(r.started * 1000), 'yyyy-MM-dd')))
    ).sort();

    let longestStreak = 0;
    let currentStreak = 1;

    for (let i = 1; i < sortedDays.length; i++) {
      const prevDay = parse(sortedDays[i - 1], 'yyyy-MM-dd', new Date());
      const currDay = parse(sortedDays[i], 'yyyy-MM-dd', new Date());
      const diff = differenceInDays(currDay, prevDay);

      if (diff === 1) {
        currentStreak++;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentStreak);

    // Longest binge session (same show, consecutive episodes)
    let longestBingeMinutes = 0;
    let longestBingeShow: string | null = null;

    const episodes = history.filter((r) => r.media_type === 'episode');
    const groupedByShow: Record<string, TautulliHistoryRecord[]> = {};

    episodes.forEach((ep) => {
      const key = ep.grandparent_rating_key.toString();
      if (!groupedByShow[key]) groupedByShow[key] = [];
      groupedByShow[key].push(ep);
    });

    Object.entries(groupedByShow).forEach(([, showEpisodes]) => {
      // Sort by start time
      const sorted = showEpisodes.sort((a, b) => a.started - b.started);

      let currentBinge = 0;
      for (let i = 0; i < sorted.length; i++) {
        currentBinge += sorted[i].duration / 60;

        // Check if next episode is within 1 hour
        if (i < sorted.length - 1) {
          const gap = sorted[i + 1].started - sorted[i].stopped;
          if (gap > 3600) {
            // More than 1 hour gap, end binge
            if (currentBinge > longestBingeMinutes) {
              longestBingeMinutes = Math.round(currentBinge);
              longestBingeShow = sorted[i].grandparent_title;
            }
            currentBinge = 0;
          }
        } else {
          // Last episode
          if (currentBinge > longestBingeMinutes) {
            longestBingeMinutes = Math.round(currentBinge);
            longestBingeShow = sorted[i].grandparent_title;
          }
        }
      }
    });

    return {
      mostActiveMonth,
      mostActiveDayOfWeek,
      mostActiveHour,
      longestStreakDays: longestStreak,
      longestBingeMinutes,
      longestBingeShow,
    };
  }

  /**
   * Calculate top content (movies, shows, episodes)
   */
  private async calculateTopContent(history: TautulliHistoryRecord[]) {
    // Top Movies
    const moviePlays: Record<number, { count: number; duration: number; record: TautulliHistoryRecord }> = {};
    history
      .filter((r) => r.media_type === 'movie')
      .forEach((r) => {
        if (!moviePlays[r.rating_key]) {
          moviePlays[r.rating_key] = { count: 0, duration: 0, record: r };
        }
        moviePlays[r.rating_key].count++;
        moviePlays[r.rating_key].duration += r.duration;
      });

    const topMovies: TopMovie[] = Object.values(moviePlays)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((m) => ({
        title: m.record.title,
        year: m.record.year,
        plays: m.count,
        durationMinutes: Math.round(m.duration / 60),
        thumb: m.record.thumb,
        ratingKey: m.record.rating_key,
        genres: m.record.genres,
      }));

    // Top Shows
    const showPlays: Record<number, { count: number; duration: number; episodes: Set<number>; record: TautulliHistoryRecord }> = {};
    history
      .filter((r) => r.media_type === 'episode')
      .forEach((r) => {
        const key = r.grandparent_rating_key;
        if (!showPlays[key]) {
          showPlays[key] = { count: 0, duration: 0, episodes: new Set(), record: r };
        }
        showPlays[key].count++;
        showPlays[key].duration += r.duration;
        showPlays[key].episodes.add(r.rating_key);
      });

    const topShows: TopShow[] = Object.values(showPlays)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((s) => ({
        title: s.record.grandparent_title,
        plays: s.count,
        episodes: s.episodes.size,
        durationMinutes: Math.round(s.duration / 60),
        thumb: s.record.grandparent_thumb,
        ratingKey: s.record.grandparent_rating_key,
        genres: s.record.genres,
      }));

    // Top Episodes (most rewatched)
    const episodePlays: Record<number, { count: number; record: TautulliHistoryRecord }> = {};
    history
      .filter((r) => r.media_type === 'episode')
      .forEach((r) => {
        if (!episodePlays[r.rating_key]) {
          episodePlays[r.rating_key] = { count: 0, record: r };
        }
        episodePlays[r.rating_key].count++;
      });

    const topEpisodes: TopEpisode[] = Object.values(episodePlays)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((e) => ({
        title: e.record.title,
        show: e.record.grandparent_title,
        season: e.record.parent_media_index,
        episode: e.record.media_index,
        plays: e.count,
        thumb: e.record.thumb,
      }));

    return {
      topMovies,
      topShows,
      topEpisodes,
    };
  }

  /**
   * Calculate top genres
   */
  private calculateTopGenres(history: TautulliHistoryRecord[]): TopGenre[] {
    const genreStats: Record<string, { count: number; minutes: number }> = {};
    const totalMinutes = history.reduce((sum, r) => sum + r.duration / 60, 0);

    history.forEach((r) => {
      const genres = r.genres || [];
      genres.forEach((genre) => {
        if (!genreStats[genre]) {
          genreStats[genre] = { count: 0, minutes: 0 };
        }
        genreStats[genre].count++;
        genreStats[genre].minutes += r.duration / 60;
      });
    });

    return Object.entries(genreStats)
      .sort(([, a], [, b]) => b.minutes - a.minutes)
      .slice(0, 10)
      .map(([genre, stats]) => ({
        genre,
        count: stats.count,
        minutes: Math.round(stats.minutes),
        percentage: parseFloat(((stats.minutes / totalMinutes) * 100).toFixed(1)),
      }));
  }

  /**
   * Calculate top actors and directors
   */
  private async calculateTopPeople(history: TautulliHistoryRecord[]) {
    const actorCounts: Record<string, { count: number; titles: Set<string> }> = {};
    const directorCounts: Record<string, { count: number; titles: Set<string> }> = {};

    history.forEach((r) => {
      // Actors
      (r.actors || []).forEach((actor) => {
        if (!actorCounts[actor]) {
          actorCounts[actor] = { count: 0, titles: new Set() };
        }
        actorCounts[actor].count++;
        actorCounts[actor].titles.add(r.title);
      });

      // Directors
      (r.directors || []).forEach((director) => {
        if (!directorCounts[director]) {
          directorCounts[director] = { count: 0, titles: new Set() };
        }
        directorCounts[director].count++;
        directorCounts[director].titles.add(r.title);
      });
    });

    const topActors: TopPerson[] = Object.entries(actorCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        count: data.count,
        titles: Array.from(data.titles).slice(0, 5),
      }));

    const topDirectors: TopPerson[] = Object.entries(directorCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        count: data.count,
        titles: Array.from(data.titles).slice(0, 5),
      }));

    return { topActors, topDirectors };
  }

  /**
   * Calculate device and platform stats
   */
  private calculateDeviceStats(history: TautulliHistoryRecord[]) {
    const deviceStats: Record<string, { plays: number; minutes: number; platform: string }> = {};
    const platformStats: Record<string, { plays: number; minutes: number }> = {};
    const qualityStats: QualityStats = {
      directPlay: 0,
      transcode: 0,
      directStream: 0,
      resolutions: {},
    };

    history.forEach((r) => {
      // Device stats
      const deviceKey = `${r.player}-${r.platform}`;
      if (!deviceStats[deviceKey]) {
        deviceStats[deviceKey] = { plays: 0, minutes: 0, platform: r.platform };
      }
      deviceStats[deviceKey].plays++;
      deviceStats[deviceKey].minutes += r.duration / 60;

      // Platform stats
      if (!platformStats[r.platform]) {
        platformStats[r.platform] = { plays: 0, minutes: 0 };
      }
      platformStats[r.platform].plays++;
      platformStats[r.platform].minutes += r.duration / 60;

      // Quality stats
      if (r.transcode_decision === 'transcode') {
        qualityStats.transcode++;
      } else if (r.transcode_decision === 'copy') {
        qualityStats.directStream++;
      } else {
        qualityStats.directPlay++;
      }

      // Resolution stats
      const res = r.stream_video_resolution || 'unknown';
      qualityStats.resolutions[res] = (qualityStats.resolutions[res] || 0) + 1;
    });

    const topDevices: DeviceStat[] = Object.entries(deviceStats)
      .sort(([, a], [, b]) => b.plays - a.plays)
      .slice(0, 5)
      .map(([device, stats]) => ({
        device: device.split('-')[0],
        platform: stats.platform,
        plays: stats.plays,
        minutes: Math.round(stats.minutes),
      }));

    const topPlatforms: PlatformStat[] = Object.entries(platformStats)
      .sort(([, a], [, b]) => b.plays - a.plays)
      .slice(0, 5)
      .map(([platform, stats]) => ({
        platform,
        plays: stats.plays,
        minutes: Math.round(stats.minutes),
      }));

    return { topDevices, topPlatforms, qualityStats };
  }

  /**
   * Calculate monthly breakdown
   */
  private calculateMonthlyStats(history: TautulliHistoryRecord[]): MonthlyStat[] {
    const monthlyData: Record<string, { plays: number; minutes: number }> = {};

    history.forEach((r) => {
      const month = format(new Date(r.started * 1000), 'yyyy-MM');
      const monthName = format(new Date(r.started * 1000), 'MMMM');
      const key = `${month}|${monthName}`;

      if (!monthlyData[key]) {
        monthlyData[key] = { plays: 0, minutes: 0 };
      }
      monthlyData[key].plays++;
      monthlyData[key].minutes += r.duration / 60;
    });

    return Object.entries(monthlyData)
      .map(([key, stats]) => {
        const [month, monthName] = key.split('|');
        return {
          month,
          monthName,
          plays: stats.plays,
          minutes: Math.round(stats.minutes),
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Calculate fun stats
   */
  private calculateFunStats(history: TautulliHistoryRecord[]) {
    // Rewatches (same content watched more than once)
    const contentPlays: Record<number, number> = {};
    history.forEach((r) => {
      contentPlays[r.rating_key] = (contentPlays[r.rating_key] || 0) + 1;
    });
    const rewatches = Object.values(contentPlays).filter((count) => count > 1).length;

    // First and last watch
    const sorted = [...history].sort((a, b) => a.started - b.started);
    const firstWatch = sorted[0];
    const lastWatch = sorted[sorted.length - 1];

    // Most memorable day (most watch time in a single day)
    const dayStats: Record<string, { minutes: number; date: Date }> = {};
    history.forEach((r) => {
      const day = format(new Date(r.started * 1000), 'yyyy-MM-dd');
      if (!dayStats[day]) {
        dayStats[day] = { minutes: 0, date: new Date(r.started * 1000) };
      }
      dayStats[day].minutes += r.duration / 60;
    });

    const mostMemorableDay = Object.values(dayStats).sort((a, b) => b.minutes - a.minutes)[0];

    // Completed seasons (watched all episodes in a season)
    // This would require additional metadata queries, so we'll estimate
    const totalSeasonsCompleted = 0; // TODO: Implement with metadata queries

    return {
      percentageOfLibraryWatched: 0, // TODO: Calculate based on library size
      totalSeasonsCompleted,
      rewatches,
      firstWatchTitle: firstWatch?.title || null,
      firstWatchDate: firstWatch ? new Date(firstWatch.started * 1000) : null,
      lastWatchTitle: lastWatch?.title || null,
      lastWatchDate: lastWatch ? new Date(lastWatch.started * 1000) : null,
      mostMemorableDayDate: mostMemorableDay?.date || null,
      mostMemorableDayMinutes: Math.round(mostMemorableDay?.minutes || 0),
    };
  }

  /**
   * Generate fun facts
   */
  private generateFunFacts(
    history: TautulliHistoryRecord[],
    basicStats: any,
    patterns: any,
    overseerrStats?: OverseerrUserRequestStats
  ): string[] {
    const facts: string[] = [];

    // Marathon sessions
    if (patterns.longestBingeMinutes > 180) {
      facts.push(`Marathon Master - Binged ${patterns.longestBingeShow} for ${Math.round(patterns.longestBingeMinutes / 60)} hours!`);
    }

    // Night owl
    if (patterns.mostActiveHour >= 22 || patterns.mostActiveHour <= 4) {
      facts.push(`Night Owl - Most active viewing at ${patterns.mostActiveHour}:00`);
    }

    // Early bird
    if (patterns.mostActiveHour >= 5 && patterns.mostActiveHour <= 8) {
      facts.push(`Early Bird - Started the day with content at ${patterns.mostActiveHour}:00 AM`);
    }

    // Consistent viewer
    if (basicStats.daysActive > 300) {
      facts.push(`Dedicated Viewer - Active on ${basicStats.daysActive} days this year!`);
    }

    // Binge watcher
    if (basicStats.totalTvEpisodes > 500) {
      facts.push(`TV Enthusiast - Watched ${basicStats.totalTvEpisodes} episodes this year`);
    }

    // Movie buff
    if (basicStats.totalMovies > 100) {
      facts.push(`Movie Buff - Watched ${basicStats.totalMovies} movies this year`);
    }

    // Overseerr facts
    if (overseerrStats && overseerrStats.totalRequests > 20) {
      facts.push(`Content Curator - Requested ${overseerrStats.totalRequests} new titles`);
    }

    if (overseerrStats && overseerrStats.averageApprovalTimeHours && overseerrStats.averageApprovalTimeHours < 2) {
      facts.push(`VIP Treatment - Average request approval in ${Math.round(overseerrStats.averageApprovalTimeHours)} hours`);
    }

    return facts;
  }

  /**
   * Generate badges
   */
  private generateBadges(
    history: TautulliHistoryRecord[],
    basicStats: any,
    patterns: any,
    overseerrStats?: OverseerrUserRequestStats
  ): Badge[] {
    const badges: Badge[] = [];

    if (patterns.longestBingeMinutes > 240) {
      badges.push({
        name: 'Marathon Master',
        description: 'Binged for over 4 hours straight',
        icon: '🏃',
      });
    }

    if (patterns.longestStreakDays > 30) {
      badges.push({
        name: 'Consistent Viewer',
        description: `${patterns.longestStreakDays} day viewing streak`,
        icon: '🔥',
      });
    }

    if (basicStats.totalTvEpisodes > 500) {
      badges.push({
        name: 'TV Fanatic',
        description: 'Watched over 500 episodes',
        icon: '📺',
      });
    }

    if (basicStats.totalMovies > 100) {
      badges.push({
        name: 'Cinema Enthusiast',
        description: 'Watched over 100 movies',
        icon: '🎬',
      });
    }

    if (overseerrStats && overseerrStats.totalRequests > 50) {
      badges.push({
        name: 'Content Curator',
        description: 'Requested over 50 titles',
        icon: '📝',
      });
    }

    return badges;
  }

  /**
   * Get empty stats object
   */
  private getEmptyStats(): ProcessedStats {
    return {
      totalWatchTimeMinutes: 0,
      totalPlays: 0,
      totalMovies: 0,
      totalTvEpisodes: 0,
      uniqueMovies: 0,
      uniqueShows: 0,
      daysActive: 0,
      mostActiveMonth: 'January',
      mostActiveDayOfWeek: 'Saturday',
      mostActiveHour: 20,
      longestStreakDays: 0,
      longestBingeMinutes: 0,
      longestBingeShow: null,
      topMovies: [],
      topShows: [],
      topEpisodes: [],
      topGenres: [],
      topActors: [],
      topDirectors: [],
      topDevices: [],
      topPlatforms: [],
      qualityStats: {
        directPlay: 0,
        transcode: 0,
        directStream: 0,
        resolutions: {},
      },
      monthlyStats: [],
      contentSharedWith: 0,
      percentageOfLibraryWatched: 0,
      totalSeasonsCompleted: 0,
      rewatches: 0,
      firstWatchTitle: null,
      firstWatchDate: null,
      lastWatchTitle: null,
      lastWatchDate: null,
      mostMemorableDayDate: null,
      mostMemorableDayMinutes: 0,
      funFacts: [],
      badges: [],
    };
  }
}

export default StatsCalculator;
