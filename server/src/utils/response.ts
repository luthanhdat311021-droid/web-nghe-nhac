import { Response } from 'express';

export const sendSuccess = <T>(res: Response, data: T, message?: string, statusCode: number = 200) => {
  return res.status(statusCode).json({
    success: true,
    message: message || 'Success',
    data,
  });
};

export const sendError = (res: Response, message: string = 'Internal Server Error', statusCode: number = 500, errors?: any) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    data: errors || null,
  });
};
