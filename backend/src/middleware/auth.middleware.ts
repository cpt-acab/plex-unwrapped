import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    iat: number;
    exp: number;
  };
}

/**
 * JWT authentication middleware
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'No token provided',
    });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.error('JWT_SECRET is not configured');
    res.status(500).json({
      error: 'Server configuration error',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Token expired',
        message: 'Please log in again',
      });
      return;
    }

    res.status(403).json({
      error: 'Invalid token',
      message: 'Authentication failed',
    });
    return;
  }
}

/**
 * Generate JWT token
 */
export function generateToken(payload: { id: number; username: string }): string {
  const jwtSecret: string = process.env.JWT_SECRET || 'change-this-secret';
  const expiresIn: string = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(payload, jwtSecret, { expiresIn } as any);
}

/**
 * Verify password (basic implementation)
 */
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export default {
  authenticateToken,
  generateToken,
  hashPassword,
  verifyPassword,
};
