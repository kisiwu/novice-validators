import { controllerOf } from '../src/index.js';
import routing from '@novice1/routing';
import express from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import request from 'supertest';

describe('Response (controllerOf) tests', () => {
  let app: express.Express;

  beforeEach(() => {
    // Setup code before each test
    app = express();
  });

  it('should return the same json response from synchronous handlers', async () => {
    const router = routing()
      .get('/original', (_, res) => {
        res.json({ message: 'Hello World' });
      })
      .get(
        '/controller',
        controllerOf((_, res) => {
          res.json({ message: 'Hello World' });
        })
      )
      .get(
        '/controller-return',
        controllerOf(() => ({ message: 'Hello World' }))
      );

    app.use(router);

    await request(app).get('/original').expect('Content-Type', /json/).expect(200, { message: 'Hello World' });
    await request(app).get('/controller').expect('Content-Type', /json/).expect(200, { message: 'Hello World' });
    await request(app).get('/controller-return').expect('Content-Type', /json/).expect(200, { message: 'Hello World' });
  });

  it('should return the same text response from synchronous handlers', async () => {
    const router = routing()
      .get('/original', (_, res) => {
        res.send('Hello World');
      })
      .get(
        '/controller',
        controllerOf((_, res) => {
          res.send('Hello World');
        })
      )
      .get(
        '/controller-return',
        controllerOf<{ resBody: string }>(() => 'Hello World')
      );

    app.use(router);

    await request(app).get('/original').expect('Content-Type', /text/).expect(200, 'Hello World');
    await request(app).get('/controller').expect('Content-Type', /text/).expect(200, 'Hello World');
    await request(app).get('/controller-return').expect('Content-Type', /text/).expect(200, 'Hello World');
  });

  it('should return the same json response from asynchronous handlers', async () => {
    const router = routing()
      .get('/original', async (_, res) => {
        res.json({ message: 'Hello World' });
      })
      .get(
        '/controller',
        controllerOf(async (_, res) => {
          res.json({ message: 'Hello World' });
        })
      )
      .get(
        '/controller-return',
        controllerOf(async () => ({ message: 'Hello World' }))
      );

    app.use(router);

    await request(app).get('/original').expect('Content-Type', /json/).expect(200, { message: 'Hello World' });
    await request(app).get('/controller').expect('Content-Type', /json/).expect(200, { message: 'Hello World' });
    await request(app).get('/controller-return').expect('Content-Type', /json/).expect(200, { message: 'Hello World' });
  });

  it('should return the same text response from asynchronous handlers', async () => {
    const router = routing()
      .get('/original', async (_, res) => {
        res.send('Hello World');
      })
      .get(
        '/controller',
        controllerOf(async (_, res) => {
          res.send('Hello World');
        })
      )
      .get(
        '/controller-return',
        controllerOf(async () => 'Hello World')
      );

    app.use(router);

    await request(app).get('/original').expect('Content-Type', /text/).expect(200, 'Hello World');
    await request(app).get('/controller').expect('Content-Type', /text/).expect(200, 'Hello World');
    await request(app).get('/controller-return').expect('Content-Type', /text/).expect(200, 'Hello World');
  });

  it('should return a stream', async () => {
    const router = routing()
      .get('/original', async (_, res) => {
        const stream = new ReadableStream({
          start(streamController) {
            streamController.enqueue(new TextEncoder().encode('Hello World'));
            streamController.close();
          },
        });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        try {
          // Convert Web ReadableStream -> Node.js Readable stream, then pipe to res
          await pipeline(Readable.fromWeb(stream), res);
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            if (!res.headersSent) {
              res.status(500).end('Internal Server Error');
            }
          }
        }
      })
      .get(
        '/controller',
        controllerOf(async (_, res) => {
          const stream = new ReadableStream({
            start(streamController) {
              streamController.enqueue(new TextEncoder().encode('Hello World'));
              streamController.close();
            },
          });
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          try {
            await pipeline(Readable.fromWeb(stream), res);
          } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
              if (!res.headersSent) {
                res.status(500).end('Internal Server Error');
              }
            }
          }
        })
      )
      .get(
        '/controller-return',
        // TS: force the response type to be a Web ReadableStream
        controllerOf<{ resBody: ReadableStream }>(async (_, res) => {
          const stream = new ReadableStream({
            start(streamController) {
              streamController.enqueue(new TextEncoder().encode('Hello World'));
              streamController.close();
            },
          });
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          return stream; // it handles Node Readable or Web ReadableStream
        })
      );
    app.use(router);
    await request(app).get('/original').expect('Content-Type', /text/).expect(200, 'Hello World');
    await request(app).get('/controller').expect('Content-Type', /text/).expect(200, 'Hello World');
    await request(app).get('/controller-return').expect('Content-Type', /text/).expect(200, 'Hello World');
  });
});
