# @novice1/controller

Controllers for [@novice1/routing](https://github.com/kisiwu/novice-routing): write route handlers that **return** their response instead of calling `res` yourself, with typed requests and responses.

- Return an object, string, `Buffer` or stream and it is sent for you
- Async handlers work out of the box, and errors are passed on to your error middleware
- Typed params, body, query, response body and locals, either positionally or from a single object (`controllerOf`)

## Installation

```bash
npm install @novice1/controller
```

Peer dependencies for typescript users: `@novice1/routing`, `@types/express-serve-static-core` and `@types/qs`.

## `controller`

Wraps a handler into a `@novice1/routing` request handler.

```ts
import { controller } from '@novice1/controller';
import routing from '@novice1/routing';
import express from 'express';

const router = routing().get(
  '/hello',
  controller(() => ({ message: 'Hello World' }))
);

express().use(router).listen(3000);
```

You can still use `res` as usual. Returning nothing leaves the response to you:

```ts
controller((_, res) => {
  res.json({ message: 'Hello World' });
});
```

### What can be returned

If the handler returns a value (and headers aren't already sent), it is handled like this:

| Returned value                         | Result                                 |
| -------------------------------------- | -------------------------------------- |
| `undefined`                            | Nothing, you respond via `res`         |
| the `res` object                       | Nothing, already handled               |
| Web `ReadableStream` / Node `Readable` | Piped to `res` (errors are propagated) |
| Any other stream                       | Throws a `ControllerError`             |
| `Buffer`                               | `res.send(buffer)`                     |
| Object (no `Content-Type` set)         | `res.json(value)`                      |
| String (no `Content-Type` set)         | Sent as `text/plain`                   |
| Anything else                          | `res.send(value)`                      |

Errors thrown (or promises rejected) by the handler are forwarded to Express' error handling.

```ts
controller(async (req) => {
  const user = await findUser(req.params.id); // throws -> error middleware
  return user;
});
```

### Generic types

```ts
controller<Params, ResBody, ReqBody, ReqQuery, Locals, Meta>((req, res) => {
  /* ... */
});
```

```ts
controller<{ id: string }, { name: string }>((req) => ({ name: `user ${req.params.id}` }));
```

The returned value is type checked against `ResBody`.

## `controllerOf`

Same behavior as `controller`, but the types are given in **one object**, so you only list what you care about. Omitted keys fall back to their defaults (`any`, route params dictionary, `ParsedQs`).

Keys: `params`, `body`, `query`, `resBody`.

```ts
import { controllerOf } from '@novice1/controller';

routing().put(
  '/users/:id',
  controllerOf<{
    params: { id: string };
    body: { name: string };
    resBody: { id: string; name: string };
  }>((req) => ({ id: req.params.id, name: req.body.name }))
);
```

A second and third generic set `res.locals` and the response meta:

```ts
controllerOf<{ resBody: { ok: boolean } }, { userId: string }>((_, res) => ({ ok: !!res.locals.userId }));
```

The order is: `controllerOf<Schema, Locals, Meta>()`.

## Building validator helpers (advanced)

`@novice1/controller/validator-helpers` exposes `createValidatorHelpers`, used to build `route` and `withSettings` helpers for a validation library. They:

- store the route `schema`, validator `options` and `onerror` in the route `parameters`,
- infer `params` and `body` types from the schema (`req.validated()` gives the validated parts),
- wrap your handlers with `controller`.

Handlers appended after the spread are not wrapped, so type them to match the route.

```ts
import { createValidatorHelpers, type ValidatorKind } from '@novice1/controller/validator-helpers';

interface MyKind extends ValidatorKind {
  schemaBase: MySchema;
  options: MyOptions;
  output: this['input'] extends MySchema ? Infer<this['input']> : never;
}

export const { route, withSettings } = createValidatorHelpers<MyKind>({
  schemaKey: 'mySchema',
  optionsKey: 'myValidatorOptions',
});
```

```ts
router.put(
  ...withSettings({
    path: '/users/:id',
    schema: { params, body },
  }).route<{ ok: boolean }>((req) => {
    const { body, params } = req.validated!();
    return { ok: true };
  })
);
```

`withSettings(...).route<ResBody, Locals>()` only asks for what the settings don't infer.

## License

MIT
