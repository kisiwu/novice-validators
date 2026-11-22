import type { JoiKind } from './types.js';
import { createValidatorHelpers } from '@novice1/controller/validator-helpers';

export const { route, withSettings } = createValidatorHelpers<JoiKind>({
  schemaKey: 'joiSchema',
  optionsKey: 'validatorJoiOptions',
});
