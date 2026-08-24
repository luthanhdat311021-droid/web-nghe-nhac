import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UserPayload } from '../types/index.js';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (payload: UserPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
};

export const verifyToken = (token: string): UserPayload => {
  return jwt.verify(token, config.jwt.secret) as UserPayload;
};

export interface ResetTokenPayload {
  type: 'PASSWORD_RESET';
  userId: string;
  email: string;
}

export const generateResetToken = (userId: string, email: string): string => {
  const payload: ResetTokenPayload = {
    type: 'PASSWORD_RESET',
    userId,
    email,
  };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: `${config.resetToken.expiresMinutes}m`,
  });
};

export const verifyResetToken = (token: string): ResetTokenPayload => {
  const decoded = jwt.verify(token, config.jwt.secret) as ResetTokenPayload;
  if (decoded.type !== 'PASSWORD_RESET') {
    throw new Error('Invalid token purpose');
  }
  return decoded;
};

