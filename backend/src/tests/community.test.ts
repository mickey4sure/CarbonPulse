import { expect } from 'chai';
import request from 'supertest';
import sinon from 'sinon';
import * as firebaseLib from '../lib/firebase';
import { setPrismaClient, resetPrismaClient } from '../lib/db';
import { createApp } from '../app';

const FIREBASE_UID = 'test-firebase-uid-abc123';
const MOCK_USER_ID = 1;
const AUTH_HEADER = 'Bearer fake-test-token';

function stubFirebaseAuth() {
  return sinon.stub(firebaseLib.auth, 'verifyIdToken').resolves({
    uid: FIREBASE_UID,
    email: 'test@carbonnudge.com',
    aud: '',
    auth_time: 0,
    exp: 0,
    firebase: { identities: {}, sign_in_provider: 'password' },
    iat: 0,
    iss: '',
    sub: FIREBASE_UID,
  });
}

function mockPrisma(overrides: Record<string, any> = {}) {
  const defaults = {
    user: {
      findUnique: sinon.stub().resolves({ id: MOCK_USER_ID, firebaseUid: FIREBASE_UID, email: 'test@carbonnudge.com' }),
    },
    challengeParticipant: {
      findMany: sinon.stub().resolves([{ challengeId: 'c1' }]),
      upsert: sinon.stub().resolves({ id: 1, userId: MOCK_USER_ID, challengeId: 'c1' }),
      deleteMany: sinon.stub().resolves({ count: 1 }),
      groupBy: sinon.stub().resolves([{ challengeId: 'c1', _count: { _all: 10 } }]),
    },
    channel: {
      findMany: sinon.stub().resolves([
        { id: 'general', name: '#general', description: 'General discussion' }
      ]),
      findUnique: sinon.stub().resolves({ id: 'general', name: '#general', description: 'General discussion' }),
    },
    comment: {
      findMany: sinon.stub().resolves([
        {
          id: 1,
          channelId: 'general',
          content: 'Hello green world',
          createdAt: new Date('2024-06-01T12:00:00Z'),
          user: {
            id: MOCK_USER_ID,
            email: 'test@carbonnudge.com',
            name: 'Eco Warrior',
            username: 'ecowarrior',
            avatar: null,
          },
        },
      ]),
      create: sinon.stub().resolves({
        id: 2,
        channelId: 'general',
        content: 'Awesome plan!',
        createdAt: new Date('2024-06-01T13:00:00Z'),
        user: {
          id: MOCK_USER_ID,
          email: 'test@carbonnudge.com',
          name: 'Eco Warrior',
          username: 'ecowarrior',
          avatar: null,
        },
      }),
    },
  };

  return { ...defaults, ...overrides } as any;
}

describe('Community Challenges & Discussions API', () => {
  let authStub: sinon.SinonStub;

  beforeEach(() => {
    authStub = stubFirebaseAuth();
  });

  afterEach(() => {
    authStub.restore();
    resetPrismaClient();
  });

  describe('GET /api/challenges/joined', () => {
    it('returns 200 with list of joined challenge IDs', async () => {
      setPrismaClient(mockPrisma());
      const res = await request(createApp())
        .get('/api/challenges/joined')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal(['c1']);
    });
  });

  describe('POST /api/challenges/:challengeId/join', () => {
    it('returns 200 and success status on joining', async () => {
      setPrismaClient(mockPrisma());
      const res = await request(createApp())
        .post('/api/challenges/c1/join')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.join).to.have.property('challengeId', 'c1');
    });
  });

  describe('POST /api/challenges/:challengeId/leave', () => {
    it('returns 200 and success status on leaving', async () => {
      setPrismaClient(mockPrisma());
      const res = await request(createApp())
        .post('/api/challenges/c1/leave')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
    });
  });

  describe('GET /api/challenges/stats', () => {
    it('returns 200 with challenge stats mapping', async () => {
      setPrismaClient(mockPrisma());
      const res = await request(createApp())
        .get('/api/challenges/stats')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('c1', 10);
    });
  });

  describe('GET /api/discussion/channels', () => {
    it('returns 200 with list of channels', async () => {
      setPrismaClient(mockPrisma());
      const res = await request(createApp())
        .get('/api/discussion/channels')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array');
      expect(res.body[0]).to.have.property('id', 'general');
    });
  });

  describe('GET /api/discussion/channels/:channelId/comments', () => {
    it('returns 200 with chronological formatted comments', async () => {
      setPrismaClient(mockPrisma());
      const res = await request(createApp())
        .get('/api/discussion/channels/general/comments')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array').with.lengthOf(1);
      expect(res.body[0]).to.have.property('content', 'Hello green world');
      expect(res.body[0].user).to.have.property('cleanName', '@ecowarrior');
      expect(res.body[0].user).to.have.property('isSelf', true);
    });
  });

  describe('POST /api/discussion/channels/:channelId/comments', () => {
    it('returns 201 with the newly created formatted comment', async () => {
      setPrismaClient(mockPrisma());
      const res = await request(createApp())
        .post('/api/discussion/channels/general/comments')
        .set('Authorization', AUTH_HEADER)
        .send({ content: 'Awesome plan!' });

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('content', 'Awesome plan!');
      expect(res.body.user).to.have.property('cleanName', '@ecowarrior');
    });

    it('returns 400 when content is empty or missing', async () => {
      setPrismaClient(mockPrisma());
      const res = await request(createApp())
        .post('/api/discussion/channels/general/comments')
        .set('Authorization', AUTH_HEADER)
        .send({ content: '' });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('errors');
    });
  });
});
