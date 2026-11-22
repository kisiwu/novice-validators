import { controller } from '../src/index.js';
import routing from '@novice1/routing';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';

describe('Request tests', () => {
  let app: express.Express;

  beforeEach(() => {
    // Setup code before each test
    app = express();
    app.use(express.json());
    app.use(cookieParser());
  });

  it('should retrieve path parameters correctly', async () => {
    const router = routing().get(
      '/user/:id',
      controller(({ params: { id } }) => ({ id }))
    );

    app.use(router);

    await request(app).get('/user/123').expect('Content-Type', /json/).expect(200, { id: '123' });
  });

  it('should retrieve query parameters correctly', async () => {
    const router = routing().get(
      '/search',
      controller(({ query: { term } }) => ({ term }))
    );

    app.use(router);

    await request(app).get('/search?term=novice').expect('Content-Type', /json/).expect(200, { term: 'novice' });
  });

  it('should retrieve body parameters correctly', async () => {
    const router = routing().post(
      '/user',
      controller(({ body: { name } }) => ({ name }))
    );

    app.use(router);

    await request(app)
      .post('/user')
      .send({ name: 'John' })
      .expect('Content-Type', /json/)
      .expect(200, { name: 'John' });
  });

  it('should retrieve headers correctly', async () => {
    const router = routing().get(
      '/headers',
      controller(({ headers: { 'x-custom-header': customHeader } }) => ({ customHeader }))
    );

    app.use(router);

    await request(app)
      .get('/headers')
      .set('x-custom-header', 'value')
      .expect('Content-Type', /json/)
      .expect(200, { customHeader: 'value' });
  });

  it('should retrieve cookies correctly', async () => {
    const router = routing().get(
      '/cookies',
      controller(({ cookies: { session } }) => ({ session }))
    );

    app.use(router);

    await request(app)
      .get('/cookies')
      .set('Cookie', 'session=abc123')
      .expect('Content-Type', /json/)
      .expect(200, { session: 'abc123' });
  });

  it('should retrieve method correctly', async () => {
    const router = routing().get(
      '/method',
      controller(({ method }) => ({ method }))
    );

    app.use(router);

    await request(app).get('/method').expect('Content-Type', /json/).expect(200, { method: 'GET' });
  });

  it('should retrieve protocol correctly', async () => {
    const router = routing().get(
      '/protocol',
      controller(({ protocol }) => ({ protocol }))
    );

    app.use(router);

    await request(app).get('/protocol').expect('Content-Type', /json/).expect(200, { protocol: 'http' });
  });

  it('should retrieve hostname correctly', async () => {
    const router = routing().get(
      '/hostname',
      controller(({ hostname }) => ({ hostname }))
    );

    app.use(router);

    await request(app).get('/hostname').expect('Content-Type', /json/).expect(200, { hostname: '127.0.0.1' });
  });
});
