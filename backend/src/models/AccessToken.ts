import { db } from '../config/database';
import crypto from 'crypto';

export interface AccessToken {
  id: number;
  token: string;
  token_hash: string;
  user_wrapped_stats_id: number;
  user_id: number;
  year: number;
  created_at: Date;
  expires_at: Date | null;
  last_accessed_at: Date | null;
  access_count: number;
  is_active: boolean;
  ip_addresses: any;
  user_agents: any;
  created_by: string;
  revoked_at: Date | null;
  revoked_by: string | null;
  revoked_reason: string | null;
}

export interface AccessTokenCreate {
  user_wrapped_stats_id: number;
  user_id: number;
  year: number;
  expires_at?: Date | null;
  created_by?: string;
}

export class AccessTokenModel {
  /**
   * Generate a cryptographically secure token
   */
  static generateToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a token for storage
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create a new access token
   */
  static async create(data: AccessTokenCreate): Promise<{ token: string; record: AccessToken }> {
    const tokenLength = parseInt(process.env.TOKEN_LENGTH || '32', 10);
    const token = this.generateToken(tokenLength);
    const tokenHash = this.hashToken(token);

    // Calculate expiration if TOKEN_EXPIRATION_DAYS is set
    let expiresAt = data.expires_at || null;
    const expirationDays = parseInt(process.env.TOKEN_EXPIRATION_DAYS || '90', 10);
    if (expirationDays > 0 && !expiresAt) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + expirationDays);
      expiresAt = expiry;
    }

    const record = await db.one<AccessToken>(
      `INSERT INTO access_tokens (
        token, token_hash, user_wrapped_stats_id, user_id, year,
        expires_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        token,
        tokenHash,
        data.user_wrapped_stats_id,
        data.user_id,
        data.year,
        expiresAt,
        data.created_by || 'system',
      ]
    );

    return { token, record };
  }

  /**
   * Find by token (plain text)
   */
  static async findByToken(token: string): Promise<AccessToken | null> {
    const tokenHash = this.hashToken(token);
    return db.oneOrNone<AccessToken>(
      'SELECT * FROM access_tokens WHERE token_hash = $1 AND is_active = true',
      [tokenHash]
    );
  }

  /**
   * Find by ID
   */
  static async findById(id: number): Promise<AccessToken | null> {
    return db.oneOrNone<AccessToken>('SELECT * FROM access_tokens WHERE id = $1', [id]);
  }

  /**
   * Find by user and year
   */
  static async findByUserAndYear(userId: number, year: number): Promise<AccessToken[]> {
    return db.manyOrNone<AccessToken>(
      'SELECT * FROM access_tokens WHERE user_id = $1 AND year = $2 ORDER BY created_at DESC',
      [userId, year]
    );
  }

  /**
   * Find active token by user wrapped stats ID
   */
  static async findByWrappedStatsId(wrappedStatsId: number): Promise<AccessToken | null> {
    return db.oneOrNone<AccessToken>(
      'SELECT * FROM access_tokens WHERE user_wrapped_stats_id = $1 AND is_active = true LIMIT 1',
      [wrappedStatsId]
    );
  }

  /**
   * Track access
   */
  static async trackAccess(
    token: string,
    ipAddress: string,
    userAgent: string
  ): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    try {
      await db.none(
        `UPDATE access_tokens
         SET access_count = access_count + 1,
             last_accessed_at = CURRENT_TIMESTAMP,
             ip_addresses = COALESCE(ip_addresses, '[]'::jsonb) ||
               jsonb_build_object('ip', $2, 'timestamp', CURRENT_TIMESTAMP, 'user_agent', $3)
         WHERE token_hash = $1 AND is_active = true`,
        [tokenHash, ipAddress, userAgent]
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify token is valid
   */
  static async verifyToken(token: string): Promise<{
    valid: boolean;
    record?: AccessToken;
    reason?: string;
  }> {
    const record = await this.findByToken(token);

    if (!record) {
      return { valid: false, reason: 'Token not found' };
    }

    if (!record.is_active) {
      return { valid: false, record, reason: 'Token has been revoked' };
    }

    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      return { valid: false, record, reason: 'Token has expired' };
    }

    return { valid: true, record };
  }

  /**
   * Revoke token
   */
  static async revoke(
    id: number,
    revokedBy: string,
    reason?: string
  ): Promise<AccessToken | null> {
    return db.oneOrNone<AccessToken>(
      `UPDATE access_tokens
       SET is_active = false,
           revoked_at = CURRENT_TIMESTAMP,
           revoked_by = $2,
           revoked_reason = $3
       WHERE id = $1
       RETURNING *`,
      [id, revokedBy, reason || null]
    );
  }

  /**
   * Revoke all tokens for a user and year
   */
  static async revokeAllForUserYear(
    userId: number,
    year: number,
    revokedBy: string
  ): Promise<number> {
    const result = await db.result(
      `UPDATE access_tokens
       SET is_active = false,
           revoked_at = CURRENT_TIMESTAMP,
           revoked_by = $3
       WHERE user_id = $1 AND year = $2 AND is_active = true`,
      [userId, year, revokedBy]
    );
    return result.rowCount;
  }

  /**
   * Delete expired tokens
   */
  static async deleteExpired(): Promise<number> {
    const result = await db.result(
      'DELETE FROM access_tokens WHERE expires_at < CURRENT_TIMESTAMP'
    );
    return result.rowCount;
  }

  /**
   * Count active tokens for user and year
   */
  static async countActiveForUserYear(userId: number, year: number): Promise<number> {
    const result = await db.one<{ count: string }>(
      'SELECT COUNT(*) FROM access_tokens WHERE user_id = $1 AND year = $2 AND is_active = true',
      [userId, year]
    );
    return parseInt(result.count, 10);
  }
}

export default AccessTokenModel;
