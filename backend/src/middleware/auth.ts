import { Request, Response, NextFunction } from 'express';
import admin, { auth } from '../lib/firebase';

export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Development/demo fallback for easy local testing
    if (process.env.NODE_ENV !== 'production' && token.startsWith('mock-')) {
      req.user = {
        uid: token.substring(5),
        email: `${token.substring(5)}@carbonnudge.com`,
        aud: '',
        auth_time: 0,
        exp: Math.floor(Date.now() / 1000) + 3600,
        firebase: { identities: {}, sign_in_provider: 'password' },
        iat: Math.floor(Date.now() / 1000),
        iss: '',
        sub: token.substring(5),
      };
      return next();
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Firebase Auth Error:', error);
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }
};
