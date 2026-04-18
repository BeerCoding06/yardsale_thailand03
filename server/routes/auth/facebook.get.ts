import { defineEventHandler } from "h3";
import { proxyExpressAuthGet } from "../../utils/expressAuthProxy";

export default defineEventHandler((event) =>
  proxyExpressAuthGet(event, "/auth/facebook")
);
