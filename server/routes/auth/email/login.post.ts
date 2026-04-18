import { defineEventHandler } from "h3";
import { proxyExpressAuthPost } from "../../../utils/expressAuthProxy";

export default defineEventHandler((event) =>
  proxyExpressAuthPost(event, "/auth/email/login")
);
