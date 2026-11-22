import type { TypeboxKind } from './types.js';
import { createValidatorHelpers } from '@novice1/controller';

export const { route, withSettings } = createValidatorHelpers<TypeboxKind>({
  schemaKey: 'typeboxSchema',
  optionsKey: 'validatorTypeboxOptions',
});
