import type { Express, Request, Response } from 'express';
import { createApp } from '../src/create-app';

// Vercel functions are re-invoked on every request but the Node process
// can stay warm between them — caching the initialized app avoids
// re-running Nest's full module bootstrap on every request.
let cachedApp: Express | undefined;

async function bootstrap(): Promise<Express> {
  const app = await createApp();
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: Request, res: Response) {
  if (!cachedApp) {
    cachedApp = await bootstrap();
  }
  return cachedApp(req, res);
}
