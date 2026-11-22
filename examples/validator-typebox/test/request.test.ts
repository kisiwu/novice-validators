import app from '../src/app.js';
import { expect } from 'chai';
import { Server } from 'node:http';
import request from 'supertest';

describe('Request Validator', () => {
  let server: Server;

  before(() => {
    server = app.build();
  });
  after(() => {
    server.close();
  });

  it('should validate a correct request', async () => {
    await request(server)
      .post('/api/users')
      .send({
        name: 'John Doe',
        email: 'john.doe@example.com',
      })
      .expect(200, { success: true, data: { name: 'John Doe', email: 'john.doe@example.com' } });
  });

  it('should validate an optional update request', async () => {
    await request(server)
      .put('/api/users/81')
      .send({
        name: 'Jane Doe',
      })
      .expect(200, {
        success: true,
        updated: { name: 'Jane Doe' },
        received: { name: 'Jane Doe' },
        receivedId: 81,
        updatedId: 81,
      });
  });

  it('should decode query parameters', async () => {
    await request(server)
      .get('/api/items')
      .query({
        search: 'test',
        year: '2005',
        includeArchived: 'true',
      })
      .expect(200, {
        validated: { search: 'test', year: 2005, includeArchived: true },
        raw: { search: 'test', year: '2005', includeArchived: 'true' },
      });
  });

  it('should only decode defined query parameters', async () => {
    await request(server)
      .get('/api/items')
      .query({
        search: 'test 2',
        year: '3005',
      })
      .expect(200, {
        validated: { search: 'test 2', year: 3005 },
        raw: { search: 'test 2', year: '3005' },
      });
  });

  it('should return 400 for invalid request', async () => {
    const response = await request(server)
      .post('/api/users')
      .send({
        name: '',
        email: 'invalid-email',
      })
      .expect(400);
    const resBody = response.body;
    expect(resBody).to.be.an('object').to.have.property('errors').that.is.an('array').with.lengthOf(2);
    expect(resBody.errors[0]).to.have.property('keyword', 'minLength');
    expect(resBody.errors[0]).to.have.property('instancePath', '/body/name');
    expect(resBody.errors[1]).to.have.property('keyword', 'format');
    expect(resBody.errors[1]).to.have.property('instancePath', '/body/email');
  });

  it('should return 400 for missing query parameters', async () => {
    const response = await request(server).get('/api/items').query({}).expect(400);
    const resBody = response.body;
    expect(resBody).to.be.an('object').to.have.property('errors').that.is.an('array').with.lengthOf(1);
    expect(resBody.errors[0]).to.have.property('keyword', 'required');
    expect(resBody.errors[0]).to.have.property('instancePath', '/query');
  });
});
