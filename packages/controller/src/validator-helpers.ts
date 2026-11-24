// Generic types for all type of validators
// Should be able to define the route schema and validator options for you validator
// then simply pass them to those types to build your own controller types based on your validator.
import { type Controller, controller } from './functions.js';
import type routing from '@novice1/routing';
import type * as core from 'express-serve-static-core';
import type qs from 'qs';

// A validator "kind": a type-level function schema -> output
export interface ValidatorKind {
  readonly schemaBase: unknown; // constraint for one part (body, query, ...)
  readonly options: unknown;
  readonly input: unknown; // filled in by Apply
  readonly output: unknown; // computed from `this['input']`
}
export type Apply<K extends ValidatorKind, In> = (K & { readonly input: In })['output'];

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

export type ValidatedOf<K extends ValidatorKind, S> = {
  [P in keyof S]: S[P] extends K['schemaBase'] ? Apply<K, S[P]> : never;
};

export interface SchemaController<P, ResBody, ReqBody, ReqQuery, Locals extends Record<string, any>, Meta, V> {
  (
    req: routing.Request<P, ResBody, ReqBody, ReqQuery, Locals, Meta> & { validated?(): V },
    res: core.Response<ResBody, Locals>,
    next: core.NextFunction
  ): ReturnType<Controller<P, ResBody, ReqBody, ReqQuery, Locals, Meta>>;
}

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

// SchemaMethodSettings / SchemaRouteTuple: same as today, with K threaded through
// and `options?: K['options']`.
export type SchemaMethodSettings<
  K extends ValidatorKind,
  Path,
  S extends RouteSchemaOf<K>,
  ResBody,
  Locals extends Record<string, any>,
  MetaResType,
> = routing.RouteSettings<Path, core.ParamsDictionary, ResBody, any, qs.ParsedQs, Locals, MetaResType> & {
  schema: S;
  options?: K['options'] | undefined; // was ValidatorTypeboxOptions
  onerror?: routing.ErrorRequestHandler | undefined;
};

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

export interface ValidatorBinding {
  schemaKey: string; // e.g. 'typeboxSchema'
  optionsKey: string; // e.g. 'validatorTypeboxOptions'
}

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
      ...handlers,
    ] as any;
  }

  function withSettings<Path extends core.PathParams, S extends RouteSchemaOf<K>>(
    settings: SchemaMethodSettings<K, Path, S, any, Record<string, any>, any>
  ) {
    return {
      route<ResBody = any, Locals extends Record<string, any> = Record<string, any>, Meta = any>(
        ...handlers: SchemaHandlersFor<K, Path, S, ResBody, Locals, Meta>
      ) {
        return route(settings, ...handlers.map((h) => controller(h)));
      },
    };
  }
  return { route, withSettings };
}
