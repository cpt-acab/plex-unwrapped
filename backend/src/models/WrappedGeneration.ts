import { db } from '../config/database';

export interface WrappedGeneration {
  id: number;
  year: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  started_at: Date | null;
  completed_at: Date | null;
  total_users: number;
  processed_users: number;
  successful_users: number;
  failed_users: number;
  error_log: string | null;
  triggered_by: string | null;
  config: any;
  created_at: Date;
  updated_at: Date;
}

export interface WrappedGenerationCreate {
  year: number;
  triggered_by?: string;
  config?: any;
}

export interface WrappedGenerationUpdate {
  status?: WrappedGeneration['status'];
  started_at?: Date;
  completed_at?: Date;
  total_users?: number;
  processed_users?: number;
  successful_users?: number;
  failed_users?: number;
  error_log?: string;
}

export class WrappedGenerationModel {
  static async create(data: WrappedGenerationCreate): Promise<WrappedGeneration> {
    return db.one<WrappedGeneration>(
      `INSERT INTO wrapped_generations (year, triggered_by, config, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [data.year, data.triggered_by || null, data.config || null]
    );
  }

  static async findById(id: number): Promise<WrappedGeneration | null> {
    return db.oneOrNone<WrappedGeneration>(
      'SELECT * FROM wrapped_generations WHERE id = $1',
      [id]
    );
  }

  static async findByYear(year: number): Promise<WrappedGeneration[]> {
    return db.manyOrNone<WrappedGeneration>(
      'SELECT * FROM wrapped_generations WHERE year = $1 ORDER BY created_at DESC',
      [year]
    );
  }

  static async findAll(limit = 50): Promise<WrappedGeneration[]> {
    return db.manyOrNone<WrappedGeneration>(
      'SELECT * FROM wrapped_generations ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
  }

  static async update(id: number, data: WrappedGenerationUpdate): Promise<WrappedGeneration | null> {
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

    return db.oneOrNone<WrappedGeneration>(
      `UPDATE wrapped_generations SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
  }

  static async incrementProcessed(id: number, successful: boolean): Promise<void> {
    const field = successful ? 'successful_users' : 'failed_users';
    await db.none(
      `UPDATE wrapped_generations
       SET processed_users = processed_users + 1,
           ${field} = ${field} + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  static async getLatestByYear(year: number): Promise<WrappedGeneration | null> {
    return db.oneOrNone<WrappedGeneration>(
      'SELECT * FROM wrapped_generations WHERE year = $1 ORDER BY created_at DESC LIMIT 1',
      [year]
    );
  }
}

export default WrappedGenerationModel;
