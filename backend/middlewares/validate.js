import { AppError } from '../utils/AppError.js';

/**
 * @param {import('joi').ObjectSchema} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      return next(new AppError(message, 422, 'VALIDATION_ERROR'));
    }
    req[source] = value;
    next();
  };
}
