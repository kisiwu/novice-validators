import { route, routeValidatorJoi, withSettings } from '../src/index.js';
import routing from '@novice1/routing';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { expect } from 'chai';
import express from 'express';
import type { AsyncValidationOptions } from 'joi';
import Joi from 'joi';
import type { ParsedQs } from 'qs';
import supertest from 'supertest';

// keep decode option to true
const options: AsyncValidationOptions = { stripUnknown: true } as const;

describe('Routing with decode', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  /**
   * Should return an error when unknown query parameters are provided.
   * The route options specify that unknown query parameters are not allowed.
   */
  it('should not allow unknown query parameters', async () => {
    const apiQuerySchema = Joi.object<{ search: string; year?: number; includeArchived?: boolean }>({
      search: Joi.string().required(),
      year: Joi.number().integer().optional(),
      includeArchived: Joi.boolean().optional(),
    });

    const router = routing()
      .setValidators(routeValidatorJoi())
      .get(
        ...withSettings({
          path: '/api/items',
          schema: { query: apiQuerySchema },
          options: { allowUnknown: false },
        }).route<{ original: ParsedQs; data: StandardSchemaV1.InferInput<typeof apiQuerySchema> }>((req, res) => {
          // we can force it with "!" to assert non-nullability
          // if we are sure that the validator is being used correctly
          // and don't want to write conditional checks for nullability (= being lazy)
          const validated = req.validated!();
          const search = validated.query.search;
          const year = validated.query.year;
          const includeArchived = validated.query.includeArchived;

          res.json({
            original: req.query,
            data: {
              search,
              year,
              includeArchived,
            },
          });
        })
      );

    app.use(router);

    const response = await supertest(app)
      .get('/api/items')
      .query({ search: 'Get It How You Live', year: 2005, includeArchived: true, unknownParam: 'test' })
      .set('Accept', 'application/json')
      .expect(400);
    expect(response.body).to.have.property('_original');
    expect(response.body._original).to.have.property('query');
    expect(response.body._original.query).to.deep.equal({
      search: 'Get It How You Live',
      year: '2005',
      includeArchived: 'true',
      unknownParam: 'test',
    });
    expect(response.body).to.have.property('details');
    expect(response.body.details).to.be.an('array').with.lengthOf(1);
    expect(response.body.details[0]).to.have.property('path').that.deep.equal(['query', 'unknownParam']);
    expect(response.body.details[0]).to.have.property('type', 'object.unknown');
  });

  /**
   * Should automatically decode query parameters and strip unknown ones.
   */
  it('should have decoded query parameters and stripped unknown ones', async () => {
    const apiQuerySchema = Joi.object<{ search: string; year?: number; includeArchived?: boolean }>({
      search: Joi.string().required(),
      year: Joi.number().integer().optional(),
      includeArchived: Joi.boolean().optional(),
    });

    const router = routing()
      .setValidators(routeValidatorJoi(options))
      .get(
        ...route(
          {
            path: '/api/items',
            schema: { query: apiQuerySchema },
          },
          (req, res) => {
            const validated = req.validated?.();
            const search = validated?.query?.search; // string | undefined
            const year = validated?.query?.year; // number | undefined
            const includeArchived = validated?.query?.includeArchived; // boolean | undefined

            res.json({
              original: req.query,
              data: {
                ...(validated?.query || {}),
                search,
                year,
                includeArchived,
              },
            });
          }
        )
      );

    app.use(router);

    const response = await supertest(app)
      .get('/api/items')
      .query({ search: 'Get It How You Live', year: 2005, includeArchived: true, unknownParam: 'test' })
      .set('Accept', 'application/json')
      .expect(200);
    // query parameters are always strings in the original request
    expect(response.body).to.have.property('original');
    expect(response.body.original).to.deep.equal({
      search: 'Get It How You Live',
      year: '2005',
      includeArchived: 'true',
      unknownParam: 'test',
    });
    // validated values should match the decoded query parameters
    expect(response.body).to.have.property('data');
    expect(response.body.data).to.deep.equal({ search: 'Get It How You Live', year: 2005, includeArchived: true });
    expect(response.body.data).to.not.have.property('unknownParam');
  });
});
