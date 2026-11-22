import { FrameworkApp } from '@novice1/app';
import { routeValidatorTypebox } from '@novice1/validator-typebox';

const app = new FrameworkApp({
  framework: {
    validators: [routeValidatorTypebox({ decode: true })],
  },
});

export default app;
