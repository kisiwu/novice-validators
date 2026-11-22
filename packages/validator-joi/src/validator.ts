import type { JoiKind } from './types.js';
import type { ValidatedOf } from '@novice1/controller/validator-helpers';
import type routing from '@novice1/routing';
import type { ParamsDictionary } from 'express-serve-static-core';
import Extend from 'extend';
import Joi, { isSchema, type AsyncValidationOptions } from 'joi';
import type { IncomingHttpHeaders } from 'node:http';
import type { ParsedQs } from 'qs';

const PARAMETERS_PROPS = ['params', 'body', 'query', 'headers', 'cookies', 'files'];

interface ValidationObject {
  params?: ParamsDictionary;
  body?: unknown;
  query?: ParsedQs;
  headers?: IncomingHttpHeaders;
  cookies?: unknown;
  files?: unknown;
}

type JoiSchema = Partial<Joi.Schema>;

function createSchema(value: Record<string, unknown> | JoiSchema): JoiSchema | null {
  let schema: JoiSchema | null = null;
  let tempValue = value;

  // check if schema is a valid schema
  if (tempValue) {
    // if it is not a JoiSchema
    if (!isSchema(tempValue)) {
      const tmpSchema: Record<string, JoiSchema> = {};
      const currentSchema: Record<string, JoiSchema> = tempValue as Record<string, JoiSchema>;
      PARAMETERS_PROPS.forEach((p) => {
        if (currentSchema[p] && typeof currentSchema[p] === 'object') {
          tmpSchema[p] = currentSchema[p];
        }
      });
      if (Object.keys(tempValue).length) {
        tempValue = Joi.object(tmpSchema);
      } else {
        tempValue = tmpSchema;
      }
    }

    // if it is a Joi.ObjectSchema
    if (tempValue?.type == 'object' && isSchema(tempValue)) {
      schema = tempValue;
    }
  }

  return schema;
}

function retrieveParametersValue(
  parameters?: Record<string, unknown>,
  property?: string
): JoiSchema | Record<string, unknown> | null {
  let schemaFromParameters: Record<string, unknown> | null = null;

  if (parameters && typeof parameters === 'object') {
    schemaFromParameters = parameters;

    if (property && typeof property === 'string') {
      // retrieve nested object property
      const subParameters = property
        .replace(/\[([^[\]]*)\]/g, '.$1.')
        .split('.')
        .filter((t) => t !== '')
        .reduce((prev: unknown, curr) => {
          if (prev && typeof prev === 'object' && curr in prev) {
            const tmp: unknown = prev[curr as keyof typeof prev];
            return tmp;
          }
          return;
        }, schemaFromParameters);
      if (subParameters && typeof subParameters === 'object' && !Array.isArray(subParameters)) {
        schemaFromParameters = subParameters as Record<string, unknown>;
      } else {
        schemaFromParameters = null;
      }
    }
  }
  return schemaFromParameters;
}

function retrieveSchema(parameters?: Record<string, unknown>, property?: string): JoiSchema | null {
  const v = retrieveParametersValue(parameters, property);
  if (v) {
    return createSchema(v);
  } else {
    return v;
  }
}

function buildValueToValidate(schema: JoiSchema, req: routing.Request): ValidationObject {
  const r: ValidationObject = {};

  //'params', 'body', 'query', 'headers', 'cookies', 'files'
  if (schema.$_terms?.keys.find((k: { key: string }) => k.key === 'params')) {
    r.params = req.params;
  }
  if (schema.$_terms?.keys.find((k: { key: string }) => k.key === 'body')) {
    r.body = req.body;
  }
  if (schema.$_terms?.keys.find((k: { key: string }) => k.key === 'query')) {
    r.query = req.query;
  }
  if (schema.$_terms?.keys.find((k: { key: string }) => k.key === 'headers')) {
    r.headers = req.headers;
  }
  if (schema.$_terms?.keys.find((k: { key: string }) => k.key === 'cookies')) {
    r.cookies = req.cookies;
  }
  if (schema.$_terms?.keys.find((k: { key: string }) => k.key === 'files')) {
    r.files = (req as { files?: unknown }).files;
  }

  return r;
}

export function validatorJoi(
  options?: AsyncValidationOptions,
  onerror?: routing.ErrorRequestHandler,
  schemaProperty?: string
): routing.RequestHandler {
  options = options || { stripUnknown: true };

  return function validatorJoiRequestHandler(req, res, next) {
    // retrieve schema
    const schema = retrieveSchema(req.meta?.parameters, schemaProperty);

    // no schema to validate
    if (!schema) {
      return next();
    } else {
      // object that we will validate
      const value = buildValueToValidate(schema, req);

      const validatorJoiOptions = req.meta?.parameters?.validatorJoiOptions || options;

      // validate schema
      return schema.validateAsync?.(value, validatorJoiOptions).then(
        (validatedValue) => {
          // because 'query' is readonly since Express v5
          const { query: _, ...validatedProps } = validatedValue;
          (req as routing.Request & { validated: () => ValidatedOf<JoiKind, typeof schema> }).validated = () =>
            validatedValue;

          Extend(req, validatedProps);
          next();
        },
        (err) => {
          if (typeof req.meta.parameters?.onerror === 'function') {
            return req.meta.parameters.onerror(err, req, res, next);
          }
          if (onerror) {
            if (typeof onerror === 'function') {
              return onerror(err, req, res, next);
            }
          }
          return res.status(400).json(err);
        }
      );
    }
  };
}

export function routeValidatorJoi(options?: AsyncValidationOptions, onerror?: routing.ErrorRequestHandler) {
  return validatorJoi(options, onerror, 'joiSchema');
}
