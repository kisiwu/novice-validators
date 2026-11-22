import type routing from '@novice1/routing';
import { Type, IsObject } from 'typebox';
import { Compile } from 'typebox/compile';

export const validatorErrorHandler: routing.ErrorRequestHandler = (err, req, res) => {
  const errorMessage = err?.errors?.[0]?.message;
  if (errorMessage === 'Decode') {
    // Decode does not have enough details to provide a specific message
    // so we attempt to reconstruct the validation errors using the TypeBox schema
    // and without decoding the request first
    const typeboxSchema = req.meta.parameters?.typeboxSchema;
    if (typeboxSchema) {
      const errors = IsObject(typeboxSchema)
        ? Compile(typeboxSchema).Errors({
            body: req.body,
          })
        : Compile(Type.Object(typeboxSchema)).Errors({
            params: req.params,
            body: req.body,
            query: req.query,
            headers: req.headers,
            cookies: req.cookies,
            files: (req as { files?: unknown }).files,
          });
      return res.status(400).json({ errors });
    }
  }
  return res.status(400).json(err);
};
