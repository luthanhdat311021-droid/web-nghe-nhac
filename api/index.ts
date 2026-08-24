import app from '../server/src/server.js';

export default function handler(req: any, res: any) {
  return app(req, res);
}
