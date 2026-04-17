import Joi from 'joi';

const uuid = Joi.string().uuid({ version: 'uuidv4' });

/** POST /api/save-token — FCM device token (auth required; user from JWT) */
export const saveFcmTokenSchema = Joi.object({
  token: Joi.string().trim().min(1).max(4096).required(),
  device: Joi.string().trim().max(64).optional().default('web'),
});

/** POST /api/send-notification — admin only */
export const sendFcmNotificationSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  body: Joi.string().trim().min(1).max(4000).required(),
  data: Joi.object().optional().default({}),
  user_ids: Joi.array().items(uuid).optional().default([]),
  tokens: Joi.array().items(Joi.string().trim().min(1).max(4096)).optional().default([]),
  image: Joi.string().trim().max(2048).optional().allow('', null),
  click_action: Joi.string().trim().max(2048).optional().allow('', null),
});

/** POST /api/broadcast — admin only */
export const broadcastFcmSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  body: Joi.string().trim().min(1).max(4000).required(),
  data: Joi.object().optional().default({}),
  image: Joi.string().trim().max(2048).optional().allow('', null),
  click_action: Joi.string().trim().max(2048).optional().allow('', null),
});
