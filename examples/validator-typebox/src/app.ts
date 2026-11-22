import { validatorErrorHandler } from './middlewares.js';
import router from './router.js';
import { FrameworkApp } from '@novice1/app';
import { routeValidatorTypebox } from '@novice1/validator-typebox';
import express from 'express';

const app = new FrameworkApp({
  framework: {
    middlewares: [express.json()],
    validators: [routeValidatorTypebox({ decode: true }, validatorErrorHandler)],
  },
  routers: [router],
});

export default app;
