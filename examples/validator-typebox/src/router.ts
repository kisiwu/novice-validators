import routing from '@novice1/routing';
import { withSettings } from '@novice1/validator-typebox';
import { Type } from 'typebox';

const router = routing();

router.post(
  {
    path: '/users',
    parameters: {
      typeboxSchema: {
        body: Type.Object({
          name: Type.String({ minLength: 1 }),
          email: Type.String({ format: 'email' }),
        }),
      },
    },
  },
  (req, res) => {
    res.json({ success: true, data: req.body });
  }
);

router.put(
  ...withSettings({
    path: '/users/:id',
    schema: {
      body: Type.Object({
        name: Type.Optional(Type.String({ minLength: 1 })),
        email: Type.Optional(Type.String({ format: 'email' })),
      }),
      params: Type.Object({
        id: Type.Integer(),
      }),
    },
  }).route<{
    success: boolean;
    updated: { name?: string; email?: string };
    received: { name?: string; email?: string };
    receivedId: number;
    updatedId: number;
  }>((req) => {
    const {
      body,
      params: { id },
    } = req.validated!();
    return { success: true, updated: body, received: req.body, receivedId: req.params.id, updatedId: id };
  })
);

router.get(
  ...withSettings({
    path: '/items',
    schema: {
      query: Type.Object({
        search: Type.String(),
        year: Type.Optional(Type.Integer()),
        includeArchived: Type.Optional(Type.Boolean()),
      }),
    },
  }).route<{ validated: { search: string; year?: number; includeArchived?: boolean }; raw: Record<string, unknown> }>(
    (req) => {
      const { query } = req.validated!();
      return { validated: query, raw: req.query };
    }
  )
);

export default routing().use('/api', router);
