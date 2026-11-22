import routing from '@novice1/routing';
import { withSettings } from '@novice1/validator-typebox';
import { Type } from 'typebox';

const router = routing();

router.post(
  {
    path: '/users',
    parameters: {
      schema: {
        body: Type.Object({
          name: Type.String(),
          email: Type.String({ format: 'email' }),
        }),
      },
    },
  },
  (req, res) => res.json({ success: true, data: req.body })
);

router.get(
  ...withSettings({
    path: '/api/items',
    schema: {
      query: Type.Object({
        search: Type.String(),
        year: Type.Optional(Type.Integer()),
        includeArchived: Type.Optional(Type.Boolean()),
      }),
    },
  }).route((req, res) => {
    const { query } = req.validated!();

    req.query.year; // '2005' (original string, untouched)
    query?.year; // 2005 (number)
    query?.includeArchived; // true (boolean)

    res.json({ validated: query, raw: req.query });
  })
);

export default routing().use('/api', router);
