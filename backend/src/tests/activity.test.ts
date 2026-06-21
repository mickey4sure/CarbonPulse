/**
 * activity.test.ts — Integration tests for /api/activities routes
 *
 * Tests all three endpoints:
 *   POST   /api/activities       — log a new activity
 *   GET    /api/activities       — list user's activities
 *   DELETE /api/activities/:id   — delete a specific activity
 *
 * Strategy:
 *  - Firebase auth is stubbed via sinon so no real JWT is needed
 *  - Prisma is replaced with an in-memory mock via setPrismaClient()
 *  - Each test resets stubs in afterEach to guarantee isolation
 */

import { expect } from 'chai';
import request from 'supertest';
import sinon from 'sinon';
import * as firebaseLib from '../lib/firebase';
import { setPrismaClient, resetPrismaClient } from '../lib/db';
import { createApp } from '../app';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIREBASE_UID = 'test-firebase-uid-abc123';
const MOCK_USER_ID = 1;

/** A real-looking Bearer token (value doesn't matter — auth is stubbed). */
const AUTH_HEADER = 'Bearer fake-test-token';

/** Stubs Firebase verifyIdToken to resolve with a decoded token for our test UID. */
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

/** Minimal mock Prisma client for the activity route. */
function mockPrisma(overrides: Record<string, any> = {}) {
  const defaults = {
    user: {
      findUnique: sinon.stub().resolves({ id: MOCK_USER_ID, firebaseUid: FIREBASE_UID, email: 'test@carbonnudge.com' }),
    },
    activityLog: {
      create: sinon.stub().resolves({
        id: 1,
        userId: MOCK_USER_ID,
        activityType: 'transit',
        label: 'car',
        value: 15,
        unit: 'km',
        co2Kg: 2.88,
        loggedAt: new Date('2024-06-01T10:00:00Z'),
      }),
      findMany: sinon.stub().resolves([
        { id: 1, activityType: 'transit', label: 'car', value: 15, unit: 'km', co2Kg: 2.88, loggedAt: new Date('2024-06-01T10:00:00Z') },
        { id: 2, activityType: 'food',    label: 'beef', value: 200, unit: 'grams', co2Kg: 5.4, loggedAt: new Date('2024-06-01T18:00:00Z') },
      ]),
      findFirst: sinon.stub().resolves({
        id: 1,
        userId: MOCK_USER_ID,
        activityType: 'transit',
        label: 'car',
        value: 15,
        unit: 'km',
        co2Kg: 2.88,
        loggedAt: new Date(),
      }),
      delete: sinon.stub().resolves({ id: 1 }),
    },
  };

  return { ...defaults, ...overrides } as any;
}

// ─── POST /api/activities ─────────────────────────────────────────────────────

describe('POST /api/activities', () => {
  let authStub: sinon.SinonStub;

  beforeEach(() => {
    authStub = stubFirebaseAuth();
  });

  afterEach(() => {
    authStub.restore();
    resetPrismaClient();
  });

  it('returns 201 with the created activity on valid input', async () => {
    setPrismaClient(mockPrisma());
    const res = await request(createApp())
      .post('/api/activities')
      .set('Authorization', AUTH_HEADER)
      .send({ activityType: 'transit', label: 'car', value: 15, unit: 'km' });

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('activity');
    expect(res.body.activity).to.have.property('co2Kg', 2.88);
    expect(res.body.activity).to.have.property('activityType', 'transit');
  });

  it('returns 400 when activityType is missing', async () => {
    setPrismaClient(mockPrisma());
    const res = await request(createApp())
      .post('/api/activities')
      .set('Authorization', AUTH_HEADER)
      .send({ label: 'car', value: 15, unit: 'km' });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('errors');
  });

  it('returns 400 when value is negative', async () => {
    setPrismaClient(mockPrisma());
    const res = await request(createApp())
      .post('/api/activities')
      .set('Authorization', AUTH_HEADER)
      .send({ activityType: 'transit', label: 'car', value: -5, unit: 'km' });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('errors');
  });

  it('returns 400 when unit is an invalid enum value', async () => {
    setPrismaClient(mockPrisma());
    const res = await request(createApp())
      .post('/api/activities')
      .set('Authorization', AUTH_HEADER)
      .send({ activityType: 'transit', label: 'car', value: 15, unit: 'miles' });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('errors');
  });

  it('returns 400 when activityType is an invalid enum value', async () => {
    setPrismaClient(mockPrisma());
    const res = await request(createApp())
      .post('/api/activities')
      .set('Authorization', AUTH_HEADER)
      .send({ activityType: 'shopping', label: 'amazon', value: 1, unit: 'km' });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('errors');
  });

  it('returns 401 when Authorization header is missing', async () => {
    authStub.restore(); // Don't stub — let real middleware reject
    authStub = sinon.stub(firebaseLib.auth, 'verifyIdToken').rejects(new Error('No token'));

    const res = await request(createApp())
      .post('/api/activities')
      .send({ activityType: 'transit', label: 'car', value: 15, unit: 'km' });

    expect(res.status).to.equal(401);
  });

  it('returns 404 when user is not found in the database', async () => {
    setPrismaClient(mockPrisma({
      user: { findUnique: sinon.stub().resolves(null) },
    }));
    const res = await request(createApp())
      .post('/api/activities')
      .set('Authorization', AUTH_HEADER)
      .send({ activityType: 'transit', label: 'car', value: 15, unit: 'km' });

    expect(res.status).to.equal(404);
    expect(res.body.error).to.include('User not found');
  });

  it('correctly calculates CO₂ for a food entry (200g beef → 5.4 kg)', async () => {
    const createStub = sinon.stub().resolves({
      id: 2, userId: MOCK_USER_ID, activityType: 'food', label: 'beef',
      value: 200, unit: 'grams', co2Kg: 5.4, loggedAt: new Date(),
    });
    setPrismaClient(mockPrisma({ activityLog: { ...mockPrisma().activityLog, create: createStub } }));

    const res = await request(createApp())
      .post('/api/activities')
      .set('Authorization', AUTH_HEADER)
      .send({ activityType: 'food', label: 'beef', value: 200, unit: 'grams' });

    expect(res.status).to.equal(201);
    // Verify the CO₂ was passed to Prisma (calculated server-side, not from client)
    const createCall = createStub.firstCall.args[0].data;
    expect(createCall.co2Kg).to.equal(5.4);
    expect(createCall.activityType).to.equal('food');
  });
});

// ─── GET /api/activities ──────────────────────────────────────────────────────

describe('GET /api/activities', () => {
  let authStub: sinon.SinonStub;

  beforeEach(() => {
    authStub = stubFirebaseAuth();
  });

  afterEach(() => {
    authStub.restore();
    resetPrismaClient();
  });

  it('returns 200 with an array of activities for the authenticated user', async () => {
    setPrismaClient(mockPrisma());
    const res = await request(createApp())
      .get('/api/activities')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('activities');
    expect(res.body.activities).to.be.an('array').with.lengthOf(2);
  });

  it('returns activities with the correct shape (id, activityType, co2Kg, loggedAt)', async () => {
    setPrismaClient(mockPrisma());
    const res = await request(createApp())
      .get('/api/activities')
      .set('Authorization', AUTH_HEADER);

    const first = res.body.activities[0];
    expect(first).to.have.all.keys('id', 'activityType', 'label', 'value', 'unit', 'co2Kg', 'loggedAt');
  });

  it('returns 401 when no auth token is provided', async () => {
    authStub.restore();
    authStub = sinon.stub(firebaseLib.auth, 'verifyIdToken').rejects(new Error('No token'));

    const res = await request(createApp()).get('/api/activities');
    expect(res.status).to.equal(401);
  });

  it('returns 200 with empty array when user has no activities', async () => {
    setPrismaClient(mockPrisma({
      activityLog: { ...mockPrisma().activityLog, findMany: sinon.stub().resolves([]) },
    }));
    const res = await request(createApp())
      .get('/api/activities')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).to.equal(200);
    expect(res.body.activities).to.deep.equal([]);
  });

  it('returns 404 when user does not exist in the database', async () => {
    setPrismaClient(mockPrisma({
      user: { findUnique: sinon.stub().resolves(null) },
    }));
    const res = await request(createApp())
      .get('/api/activities')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).to.equal(404);
  });
});

// ─── DELETE /api/activities/:id ───────────────────────────────────────────────

describe('DELETE /api/activities/:id', () => {
  let authStub: sinon.SinonStub;

  beforeEach(() => {
    authStub = stubFirebaseAuth();
  });

  afterEach(() => {
    authStub.restore();
    resetPrismaClient();
  });

  it('returns 200 and success message when deleting own activity', async () => {
    setPrismaClient(mockPrisma());
    const res = await request(createApp())
      .delete('/api/activities/1')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('message', 'Activity deleted.');
  });

  it('returns 404 when activity does not belong to the user (IDOR protection)', async () => {
    setPrismaClient(mockPrisma({
      activityLog: { ...mockPrisma().activityLog, findFirst: sinon.stub().resolves(null) },
    }));
    const res = await request(createApp())
      .delete('/api/activities/999')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).to.equal(404);
    expect(res.body.error).to.include('Activity not found');
  });

  it('returns 400 for a non-numeric activity ID', async () => {
    setPrismaClient(mockPrisma());
    const res = await request(createApp())
      .delete('/api/activities/not-a-number')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).to.equal(400);
    expect(res.body.error).to.include('Invalid activity ID');
  });

  it('returns 401 when no auth token is provided', async () => {
    authStub.restore();
    authStub = sinon.stub(firebaseLib.auth, 'verifyIdToken').rejects(new Error('No token'));

    const res = await request(createApp()).delete('/api/activities/1');
    expect(res.status).to.equal(401);
  });
});
