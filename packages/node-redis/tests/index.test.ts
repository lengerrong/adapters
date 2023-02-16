import * as redis from "redis";
import { runBasicTests } from "../../../basic-tests"
import { RedisAdapter, getObjectFromRedis } from "../src"
import "dotenv/config"

const redisClient = redis.createClient({
  url: process.env["REDIS_URL"],
  password: process.env["REDIS_PASSWORD"]
}) as redis.RedisClientType;

runBasicTests({
  adapter: RedisAdapter(redisClient, { baseKeyPrefix: "testApp:" }),
  db: {
    async user(id: string) {
      return await getObjectFromRedis(redisClient, `testApp:user:${id}`)
    },
    async account({ provider, providerAccountId }) {
      return await getObjectFromRedis(redisClient,
        `testApp:user:account:${provider}:${providerAccountId}`
      )
    },
    async session(sessionToken) {
      return await getObjectFromRedis(redisClient, `testApp:user:session:${sessionToken}`)
    },
    async verificationToken(where) {
      return await getObjectFromRedis(redisClient,
        `testApp:user:token:${where.identifier}`
      )
    },
  },
})
