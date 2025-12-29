import { db } from '../config/database';

export interface EmailLog {
  id: number;
  user_id: number | null;
  generation_id: number | null;
  email_to: string;
  email_subject: string | null;
  email_body: string | null;
  status: 'pending' | 'sent' | 'failed' | 'bounced' | 'opened' | 'clicked';
  error_message: string | null;
  sent_at: Date | null;
  delivered_at: Date | null;
  opened_at: Date | null;
  clicked_at: Date | null;
  bounced_at: Date | null;
  message_id: string | null;
  smtp_response: string | null;
  open_count: number;
  click_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface EmailLogCreate {
  user_id?: number | null;
  generation_id?: number | null;
  email_to: string;
  email_subject?: string;
  email_body?: string;
}

export interface EmailLogUpdate {
  status?: EmailLog['status'];
  error_message?: string;
  sent_at?: Date;
  delivered_at?: Date;
  opened_at?: Date;
  clicked_at?: Date;
  bounced_at?: Date;
  message_id?: string;
  smtp_response?: string;
}

export class EmailLogModel {
  static async create(data: EmailLogCreate): Promise<EmailLog> {
    return db.one<EmailLog>(
      `INSERT INTO email_logs (
        user_id, generation_id, email_to, email_subject, email_body, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *`,
      [
        data.user_id || null,
        data.generation_id || null,
        data.email_to,
        data.email_subject || null,
        data.email_body || null,
      ]
    );
  }

  static async findById(id: number): Promise<EmailLog | null> {
    return db.oneOrNone<EmailLog>('SELECT * FROM email_logs WHERE id = $1', [id]);
  }

  static async findByUser(userId: number, limit = 50): Promise<EmailLog[]> {
    return db.manyOrNone<EmailLog>(
      'SELECT * FROM email_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
  }

  static async findByGeneration(generationId: number): Promise<EmailLog[]> {
    return db.manyOrNone<EmailLog>(
      'SELECT * FROM email_logs WHERE generation_id = $1 ORDER BY created_at DESC',
      [generationId]
    );
  }

  static async findAll(limit = 100): Promise<EmailLog[]> {
    return db.manyOrNone<EmailLog>(
      'SELECT * FROM email_logs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
  }

  static async update(id: number, data: EmailLogUpdate): Promise<EmailLog | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      updates.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    return db.oneOrNone<EmailLog>(
      `UPDATE email_logs SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
  }

  static async markSent(id: number, messageId?: string, smtpResponse?: string): Promise<void> {
    await db.none(
      `UPDATE email_logs
       SET status = 'sent',
           sent_at = CURRENT_TIMESTAMP,
           message_id = $2,
           smtp_response = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, messageId || null, smtpResponse || null]
    );
  }

  static async markFailed(id: number, errorMessage: string): Promise<void> {
    await db.none(
      `UPDATE email_logs
       SET status = 'failed',
           error_message = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, errorMessage]
    );
  }

  static async markOpened(id: number): Promise<void> {
    await db.none(
      `UPDATE email_logs
       SET status = 'opened',
           opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
           open_count = open_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  static async markClicked(id: number): Promise<void> {
    await db.none(
      `UPDATE email_logs
       SET status = 'clicked',
           clicked_at = COALESCE(clicked_at, CURRENT_TIMESTAMP),
           click_count = click_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  static async getStatsByGeneration(generationId: number): Promise<{
    total: number;
    sent: number;
    failed: number;
    opened: number;
    clicked: number;
  }> {
    const result = await db.one<any>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'sent' OR status = 'opened' OR status = 'clicked') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'opened' OR status = 'clicked') as opened,
        COUNT(*) FILTER (WHERE status = 'clicked') as clicked
       FROM email_logs
       WHERE generation_id = $1`,
      [generationId]
    );

    return {
      total: parseInt(result.total, 10),
      sent: parseInt(result.sent, 10),
      failed: parseInt(result.failed, 10),
      opened: parseInt(result.opened, 10),
      clicked: parseInt(result.clicked, 10),
    };
  }

  static async countByStatus(status: EmailLog['status']): Promise<number> {
    const result = await db.one<{ count: string }>(
      'SELECT COUNT(*) FROM email_logs WHERE status = $1',
      [status]
    );
    return parseInt(result.count, 10);
  }

  static async delete(id: number): Promise<boolean> {
    const result = await db.result('DELETE FROM email_logs WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
}

export default EmailLogModel;
