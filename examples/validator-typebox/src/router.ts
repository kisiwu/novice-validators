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
  }).route((req, res) => {
    const { query } = req.validated!();
    res.json({ validated: query, raw: req.query });
  })
);

export default routing().use('/api', router);
