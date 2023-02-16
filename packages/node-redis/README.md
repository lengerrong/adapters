<p align="center">
   <br/>
   <a href="https://next-auth.js.org" target="_blank"><img height="64px" src="https://next-auth.js.org/img/logo/logo-sm.png" /></a>&nbsp;&nbsp;&nbsp;&nbsp;<img height="64px" src="logo.svg" />
   <h3 align="center"><b>Node Redis Adapter</b> - NextAuth.js</h3>
   <p align="center">
   Open Source. Full Stack. Own Your Data.
   </p>
   <p align="center" style="align: center;">
      <img src="https://github.com/nextauthjs/adapters/actions/workflows/release.yml/badge.svg" alt="CI Test" />
      <img src="https://img.shields.io/bundlephobia/minzip/@next-auth/node-redis-adapter" alt="Bundle Size"/>
      <img src="https://img.shields.io/npm/v/@next-auth/node-redis-adapter" alt="@next-auth/node-redis-adapter Version" />
   </p>
</p>

## Overview

This is the Node Redis adapter for [`next-auth`](https://next-auth.js.org). This package can only be used in conjunction with the primary `next-auth` and `redis` packages. It is not a standalone package.

## Getting Started

1. Install `next-auth` and `@next-auth/node-redis-adapter` as well as `redis` via NPM.

```js
npm install next-auth @next-auth/node-redis-adapter redis
```

2. Add the follwing code to your `pages/api/[...nextauth].js` next-auth configuration object.

```js
import NextAuth from "next-auth"
import { RedisAdapter } from "@next-auth/node-redis-adapter"
import * as redis from "redis";

const redisClient = redis.createClient({
  url: process.env["REDIS_URL"],
  password: process.env["REDIS_PASSWORD"]
}) as redis.RedisClientType;

// For more information on each option (and a full list of options) go to
// https://next-auth.js.org/configuration/options
export default NextAuth({
  ...
  adapter: RedisAdapter(redisClient)
  ...
})
```

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [Contributing Guide](https://github.com/nextauthjs/adapters/blob/main/CONTRIBUTING.md).

## License

ISC
