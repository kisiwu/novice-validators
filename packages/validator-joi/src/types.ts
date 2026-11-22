import type { ValidatorKind } from '@novice1/controller/validator-helpers';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { AnySchema, AsyncValidationOptions } from 'joi';

/**
 * Schema definition for validating request properties.
 *
 * Can be either:
 * - A TypeBox `TObject` schema wrapping all validation targets
 * - An object where each property defines validation for a specific request property
 *
 * Each property can be:
 * - A Joi `AnySchema` (e.g., `Joi.object(...)`, `Joi.string()`)
 * - A plain object with TypeBox schemas as values (e.g., `{ name: Type.String() }`)
 *
 * @example
 * ```typescript
 * // Method 1: ObjectSchema wrapper
 * const schema: ValidatorJoiObject = Joi.object({
 *   body: Joi.object({ name: Joi.string() })
 * });
 *
 * // Method 2: Plain object with AnySchema
 * const schema: ValidatorJoiObject = {
 *   body: Joi.object({ name: Joi.string() }),
 *   query: Joi.object({ page: Joi.string() })
 * };
 *
 * // Method 3: Plain object with AnySchema values
 * const schema: ValidatorJoiObject = {
 *   body: {
 *     name: Joi.string(),
 *     email: Joi.string().email()
 *   }
 * };
 * ```
 */
export type ValidatorJoiSchema =
  | AnySchema
  | {
      body?: AnySchema | { [x: string]: AnySchema };
      headers?: AnySchema | { [x: string]: AnySchema };
      cookies?: AnySchema | { [x: string]: AnySchema };
      params?: AnySchema | { [x: string]: AnySchema };
      query?: AnySchema | { [x: string]: AnySchema };
      files?: AnySchema | { [x: string]: AnySchema };
    };

export interface JoiKind extends ValidatorKind {
  schemaBase: AnySchema;
  options: AsyncValidationOptions;
  output: this['input'] extends AnySchema ? StandardSchemaV1.InferOutput<this['input']> : never;
}
