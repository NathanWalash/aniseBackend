import { Request, Response } from 'express';

// TODO: Import GoCardless client, db, and any needed utilities

export const startRedirectFlow = async (req: Request, res: Response) => {
  // TODO: Move logic from /api/start-redirect-flow here
  res.status(501).json({ message: 'Not implemented yet.' });
};

export const confirmRedirectFlow = async (req: Request, res: Response) => {
  // TODO: Move logic from /api/confirm-redirect-flow here
  res.status(501).json({ message: 'Not implemented yet.' });
};

export const createPayment = async (req: Request, res: Response) => {
  // TODO: Move logic from /api/create-payment here
  res.status(501).json({ message: 'Not implemented yet.' });
};

export const createSubscription = async (req: Request, res: Response) => {
  // TODO: Move logic from /api/create-subscription here
  res.status(501).json({ message: 'Not implemented yet.' });
};

export const listSubscriptions = async (req: Request, res: Response) => {
  // TODO: Move logic from /api/subscriptions here
  res.status(501).json({ message: 'Not implemented yet.' });
};

export const webhookHandler = async (req: Request, res: Response) => {
  // TODO: Move logic from /api/webhook here
  res.status(501).json({ message: 'Not implemented yet.' });
}; 