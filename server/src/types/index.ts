import { Request } from 'express';

export interface UserPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}
