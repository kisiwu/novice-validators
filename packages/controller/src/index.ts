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

export class ControllerError extends Error {
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
 * Controller function type
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
 * Wraps a controller function into an express request handler
 * @param handler
 * @returns
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

//#region controllerV2

export type ReqRefDefaults = {
  body: any;
  params: core.ParamsDictionary;
  query: ParsedQs;
  resBody: any;
};

export type ReqRef = Partial<Record<keyof ReqRefDefaults, any>>;

type OutputOf<S, K extends string, Fallback> = S extends { [P in K]: infer T }
  ? T extends undefined
    ? Fallback
    : Fallback
  : S;

/**
 * WIP: Wrap a controller function into an express request handler
 * @param handler
 * @returns
 */
export function controllerV2<
  Refs extends ReqRef = ReqRefDefaults,
  Locals extends Record<string, any> = Record<string, any>,
  MetaResType = unknown,
>(
  handler: Controller<
    OutputOf<Refs, 'params', core.ParamsDictionary>,
    OutputOf<Refs, 'resBody', any>,
    OutputOf<Refs, 'body', any>,
    ParsedQs,
    Locals,
    MetaResType
  >
): routing.RequestHandler<Refs['params'], Refs['resBody'], Refs['body'], Refs['query'], Locals, MetaResType> {
  return controller(handler);
}

//#endregion controllerV2
