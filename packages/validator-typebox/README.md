# @novice1/controller

Controller for @novice1/routing.

## Installation

```bash
npm install @novice1/controller
```

## Usage

### Basic Usage

```ts
import { controller } from '@novice1/controller';
import routing from '@novice1/routing';
import express from 'express';

const app = express();
const router = routing().get(
  '/example',
  controller((_, res) => {
    res.json({ message: 'Hello World' });
  })
);

app.use(router);
```

### Return response

You can return the response body directly from the controller function.

```ts
import { controller } from '@novice1/controller';
import routing from '@novice1/routing';
import express from 'express';

const app = express();
const router = routing().get(
  '/example',
  controller((_, res) => ({ message: 'Hello World' }))
);

app.use(router);
```

### Generic types

You can define the types for:

- Request parameters
- Response body
- Request body
- Request query
- Response locals

Signature:

```ts
controller<Params, ResponseBody, RequestBody, RequestQuery, ResponseLocals>((req, res) => {
  /* ... */
});
```

Example:

```ts
import { controller } from '@novice1/controller';
import routing from '@novice1/routing';
import express from 'express';

const app = express();
const router = routing().get(
  '/example',
  controller<{}, { message: string }>((_, res) => {
    res.json({ message: 'Hello World' });
  })
);

app.use(router);
```

> The first generic type `{}` represents the request parameters, and the second generic type `{ message: string }` represents the response body.
