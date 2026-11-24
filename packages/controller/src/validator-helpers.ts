// Generic types for all type of validators
// Should be able to define the route schema and validator options for you validator
// then simply pass them to those types to build your own controller types based on your validator.
import { type Controller, controller } from './functions.js';
import type routing from '@novice1/routing';
import type * as core from 'express-serve-static-core';
import type qs from 'qs';

/**
 * Type-level description of a validator library, used to derive request types from route schemas.
 * Implement it once per validator (Typebox, Zod, …) and pass it to {@link createValidatorHelpers}.
 */
export interface ValidatorKind {
  /** Constraint that any schema for one request part (body, query, …) must satisfy. */
  readonly schemaBase: unknown;
  /** Type of the validator options. */
  readonly options: unknown;
  /** Placeholder filled in by {@link Apply}; don't set it yourself. */
  readonly input: unknown;
  /** Output type computed from `this['input']`, i.e. the validated type of a schema. */
  readonly output: unknown;
}

/** Resolves the validated output type of schema `In` for validator `K`. */
export type Apply<K extends ValidatorKind, In> = (K & { readonly input: In })['output'];

/** Route schema shape: one optional schema per request part, constrained by `K['schemaBase']`. */
export type RouteSchemaOf<K extends ValidatorKind> = {
  body?: K['schemaBase'];
  query?: K['schemaBase'];
  params?: K['schemaBase'];
  headers?: K['schemaBase'];
  cookies?: K['schemaBase'];
  files?: K['schemaBase'];
};

type OutputOf<K extends ValidatorKind, S, P extends string, Fallback> = S extends { [Q in P]: infer T }
  ? T extends K['schemaBase']
    ? Apply<K, T>
    : Fallback
  : Fallback;

// Shared helper so the params type isn't repeated
type ParamsOf<K extends ValidatorKind, Path, S> = OutputOf<
  K,
  S,
  'params',
  Path extends string ? core.RouteParameters<Path> : core.ParamsDictionary
>;

/** Maps each request part in schema `S` to its validated output type (`never` if it doesn't match `K['schemaBase']`). */
export type ValidatedOf<K extends ValidatorKind, S> = {
  [P in keyof S]: S[P] extends K['schemaBase'] ? Apply<K, S[P]> : never;
};

/**
 * A {@link Controller} whose `req` also exposes `validated()`, returning the validated request parts of type `V`.
 *
 * @template V Type returned by `req.validated()`.
 */
export interface SchemaController<P, ResBody, ReqBody, ReqQuery, Locals extends Record<string, any>, Meta, V> {
  (
    req: routing.Request<P, ResBody, ReqBody, ReqQuery, Locals, Meta> & { validated?(): V },
    res: core.Response<ResBody, Locals>,
    next: core.NextFunction
  ): ReturnType<Controller<P, ResBody, ReqBody, ReqQuery, Locals, Meta>>;
}

/**
 * Array of {@link SchemaController} with request types derived from schema `S`.
 * Params default to the path's route parameters, the body to its validated type, and the query to `ParsedQs`.
 */
export type SchemaHandlersFor<
  K extends ValidatorKind,
  Path,
  S,
  ResBody,
  Locals extends Record<string, any>,
  Meta,
> = SchemaController<
  ParamsOf<K, Path, S>,
  ResBody,
  OutputOf<K, S, 'body', any>,
  qs.ParsedQs,
  Locals,
  Meta,
  ValidatedOf<K, S>
>[];

/** Route settings plus the `schema`, validator `options` and an `onerror` handler for validation failures. */
export type SchemaMethodSettings<
  K extends ValidatorKind,
  Path,
  S extends RouteSchemaOf<K>,
  ResBody,
  Locals extends Record<string, any>,
  MetaResType,
> = routing.RouteSettings<Path, core.ParamsDictionary, ResBody, any, qs.ParsedQs, Locals, MetaResType> & {
  schema: S;
  options?: K['options'] | undefined;
  onerror?: routing.ErrorRequestHandler | undefined;
};

/** Tuple `[settings, ...handlers]` produced by `route()`, ready to spread into a router method. */
export type SchemaRouteTuple<
  K extends ValidatorKind,
  Path,
  S extends RouteSchemaOf<K>,
  ResBody,
  Locals extends Record<string, any>,
  MetaResType,
> = readonly [
  routing.RouteSettings<
    Path,
    ParamsOf<K, Path, S>,
    ResBody,
    OutputOf<K, S, 'body', any>,
    qs.ParsedQs,
    Locals,
    MetaResType
  >,
  ...SchemaHandlersFor<K, Path, S, ResBody, Locals, MetaResType>,
];

/** Maps the helper's schema and options onto the keys read from route `parameters` (e.g. `'schema'`). */
export interface ValidatorBinding {
  /** Key under `parameters` where the schema is stored. */
  schemaKey: string;
  /** Key under `parameters` where the validator options are stored. */
  optionsKey: string;
}

/**
 * Builds typed `route` and `withSettings` helpers for a validator.
 *
 * - `route(settings, ...handlers)` moves `schema`, `options` and `onerror` into `parameters`
 *   (under the keys in `b`) and returns a {@link SchemaRouteTuple}.
 * - `withSettings(settings).route(...handlers)` does the same but wraps each handler with {@link controller}.
 *
 * @template K The validator kind.
 * @param b Keys under which the schema and options are stored in route `parameters`.
 */
export function createValidatorHelpers<K extends ValidatorKind>(b: ValidatorBinding) {
  function route<
    Path extends core.PathParams,
    S extends RouteSchemaOf<K>,
    ResBody,
    Locals extends Record<string, any>,
    Meta,
  >(
    settings: SchemaMethodSettings<K, Path, S, ResBody, Locals, Meta>,
    ...handlers: SchemaHandlersFor<K, Path, S, ResBody, Locals, Meta>
  ): SchemaRouteTuple<K, Path, S, ResBody, Locals, Meta> {
    const { schema, options, onerror, parameters, ...rest } = settings;
    return [
      {
        ...rest,
        parameters: {
          ...parameters,
          [b.schemaKey]: schema,
          ...(options && { [b.optionsKey]: options }),
          ...(onerror && { onerror }),
        },
      },
      ...handlers.map((h) => controller(h)),
    ] as any;
  }

  function withSettings<Path extends core.PathParams, S extends RouteSchemaOf<K>>(
    settings: SchemaMethodSettings<K, Path, S, any, Record<string, any>, any>
  ) {
    return {
      route<ResBody = any, Locals extends Record<string, any> = Record<string, any>, Meta = any>(
        ...handlers: SchemaHandlersFor<K, Path, S, ResBody, Locals, Meta>
      ) {
        return route(settings, ...handlers);
      },
    };
  }
  return { route, withSettings };
}
