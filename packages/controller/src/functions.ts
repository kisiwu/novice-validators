import type routing from '@novice1/routing';
import type * as core from 'express-serve-static-core';
import { Buffer } from 'node:buffer';
import Stream, { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { ParsedQs } from 'qs';

//#region helpers

function isWebReadableStream(stream: unknown): stream is WebReadableStream {
  return (
    typeof stream === 'object' &&
    stream !== null &&
    'getReader' in stream &&
    typeof (stream as WebReadableStream).getReader === 'function'
  );
}

function isNodeReadableStream(stream: unknown): stream is Readable {
  return (
    typeof stream === 'object' &&
    stream !== null &&
    'pipe' in stream &&
    typeof (stream as Readable).pipe === 'function' &&
    'readable' in stream
  );
}

/**
 * Error thrown by {@link controller} when a returned value can't be turned into a response
 * (for example an unsupported stream type).
 */
export class ControllerError extends Error {
  /**
   * @param message Human-readable description of the failure.
   * @param details Optional extra context (e.g. the offending value), exposed as `error.details`.
   */
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ControllerError';
    if (details) {
      (this as { details?: any }).details = details;
    }
  }
}

//#endregion helpers

//#region controller

/**
 * A request handler that may *return* its response instead of (or in addition to) calling `res`.
 * Wrap it with {@link controller} or {@link controllerOf} to get a Novice routing request handler.
 *
 * The handler may be sync or async and may return:
 * - nothing (`void`): the handler is expected to respond through `res` itself;
 * - the `res` object: treated as already handled;
 * - a response body (`ResBody`): sent by the wrapper.
 *
 * @template P Route parameters.
 * @template ResBody Response body.
 * @template ReqBody Request body.
 * @template ReqQuery Parsed query string.
 * @template Locals `res.locals` type.
 * @template MetaResType Type of the route's response meta.
 */
export interface Controller<
  P = core.ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>,
  MetaResType = any,
> {
  (
    req: routing.Request<P, ResBody, ReqBody, ReqQuery, Locals, MetaResType>,
    res: core.Response<ResBody, Locals>,
    next: core.NextFunction
  ):
    | ResBody
    | void
    | core.Response<ResBody, Locals>
    | Promise<ResBody>
    | Promise<void>
    | Promise<core.Response<ResBody, Locals>>;
}

/**
 * Wraps a {@link Controller} into a Novice routing request handler and sends whatever it returns.
 *
 * Returned values are handled as follows (skipped if `undefined` or headers were already sent):
 * - the `res` object: nothing more is done;
 * - web or Node readable stream: piped to `res` with `pipeline`;
 * - any other stream: throws a {@link ControllerError};
 * - `Buffer`: sent as is;
 * - object without a `Content-Type` header: sent with `res.json()`;
 * - string without a `Content-Type` header: sent as `text/plain`;
 * - anything else: sent with `res.send()`.
 *
 * Errors thrown or rejected by the handler are propagated to the caller of the returned handler.
 *
 * @example
 * route.get('/hello', controller(() => ({ message: 'Hello World' })));
 *
 * @template P Route parameters.
 * @template ResBody Response body.
 * @template ReqBody Request body.
 * @template ReqQuery Parsed query string.
 * @template Locals `res.locals` type.
 * @template MetaResType Type of the route's response meta.
 * @param handler The controller function to wrap.
 * @returns A Novice routing request handler that invokes the controller.
 * @throws {ControllerError} If the returned value is an unsupported stream.
 */
export function controller<
  P = core.ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>,
  MetaResType = any,
>(
  handler: Controller<P, ResBody, ReqBody, ReqQuery, Locals, MetaResType>
): routing.RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals, MetaResType> {
  return async function (req, res, next) {
    const value = await handler(req, res, next);

    // If the handler returned a value, we need to handle it appropriately
    if (typeof value != 'undefined' && !res.headersSent) {
      // if the value is the response itself, do nothing
      // It causes timeout if request handler does not properly handle the response.
      if (value === res) {
        return res;
      }

      // if web readable stream
      if (isWebReadableStream(value)) {
        // Using pipeline is safer than piping directly to res:
        // - pipeline will automatically handle errors and close the streams properly
        return await pipeline(Readable.fromWeb(value), res);
      }

      // if node readable stream
      if (isNodeReadableStream(value)) {
        // Using pipeline is safer than piping directly to res:
        // - pipeline will automatically handle errors and close the streams properly
        return await pipeline(value, res);
      }

      // if unsupported generic node stream
      if (value instanceof Stream) {
        throw new ControllerError('Unsupported stream type', { value });
      }

      // if buffer
      if (value instanceof Buffer) {
        // simply send the content
        return res.send(value);
      }

      // if no 'Content-Type' header
      if (!res.hasHeader('Content-Type')) {
        // there is no 'Content-Type' header, we have to guess how to return the content
        if (typeof value === 'object') {
          return res.json(value);
        } else if (typeof value === 'string') {
          return res.setHeader('Content-Type', 'text/plain').send(value);
        }
      }

      // simply send the content
      return res.send(value);
    }
    // do nothing
    return;
  };
}

//#endregion controller

//#region controllerOf

/**
 * Default types for each slot of {@link ReqRef}. A slot that is omitted (or `any`/`unknown`)
 * in a `ReqRef` resolves to the matching entry here.
 */
export type ReqRefDefaults = {
  body: any;
  params: core.ParamsDictionary;
  query: ParsedQs;
  resBody: any;
};

/**
 * Describes the request and response types of a controller in a single object,
 * instead of positional generics. Every key is optional.
 *
 * @example
 * type Refs = { params: { id: string }; body: { name: string }; resBody: { ok: boolean } };
 */
export type ReqRef = Partial<Record<keyof ReqRefDefaults, any>>;

type OutputOf<S, K extends keyof ReqRefDefaults, Fallback = ReqRefDefaults[K]> = K extends keyof S
  ? unknown extends Exclude<S[K], undefined> // missing, `any` or `unknown` -> use fallback
    ? Fallback
    : Exclude<S[K], undefined>
  : Fallback;

/**
 * Same as {@link controller}, but types are given as a single {@link ReqRef} object.
 * Omitted keys fall back to {@link ReqRefDefaults}, and the handler's return value
 * is checked against `resBody`.
 *
 * @example
 * controllerOf<{ params: { id: string }; resBody: { id: string } }>((req) => ({ id: req.params.id }));
 *
 * @template Refs Object with optional `params`, `body`, `query` and `resBody` types.
 * @template Locals `res.locals` type.
 * @template MetaResType Type of the route's response meta.
 * @param handler The controller function to wrap.
 * @returns A Novice routing request handler that invokes the controller.
 */
export function controllerOf<
  Refs extends ReqRef = ReqRefDefaults,
  Locals extends Record<string, any> = Record<string, any>,
  MetaResType = unknown,
>(
  handler: Controller<
    OutputOf<Refs, 'params'>,
    OutputOf<Refs, 'resBody'>,
    OutputOf<Refs, 'body'>,
    OutputOf<Refs, 'query'>,
    Locals,
    MetaResType
  >
): routing.RequestHandler<
  OutputOf<Refs, 'params'>,
  OutputOf<Refs, 'resBody'>,
  OutputOf<Refs, 'body'>,
  OutputOf<Refs, 'query'>,
  Locals,
  MetaResType
> {
  return controller(handler);
}

//#endregion controllerOf
