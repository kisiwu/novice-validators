import { controller } from '../src/index.js';
import routing from '@novice1/routing';
import express from 'express';
import request from 'supertest';

describe('Next tests', () => {
  let app: express.Express;

  beforeEach(() => {
    // Setup code before each test
    app = express();
  });

  it('should call the next middleware', async () => {
    const router = routing().get(
      '/first',
      controller((_, __, next) => {
        next();
      }),
      (_, res) => {
        res.send('Second middleware called');
      }
    );

    app.use(router);

    await request(app).get('/first').expect(200, 'Second middleware called');
  });

  it('should call the next controller', async () => {
    const router = routing().get(
      '/second',
      controller((_, __, next) => {
        next();
      }),
      controller(() => 'Next controller called')
    );

    app.use(router);

    await request(app).get('/second').expect(200, 'Next controller called');
  });

  it('should skip to 404', async () => {
    const router = routing().get(
      '/third',
      controller((_, __, next) => {
        next();
      })
    );

    app.use(router);

    await request(app).get('/third').expect(404);
  });
});
