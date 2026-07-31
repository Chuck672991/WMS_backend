<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## DevOps

### Docker

```bash
# Build image (run from the backend/ directory — it's the Docker build context)
docker build -t writing-management-backend .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=your_neon_url \
  -e REDIS_URL=your_upstash_url \
  -e JWT_ACCESS_SECRET=your_secret \
  -e JWT_REFRESH_SECRET=your_secret \
  writing-management-backend
```

The image is a multi-stage build (`node:20-alpine`): a `builder` stage installs
dependencies, generates the Prisma client, and compiles TypeScript; a `runtime`
stage installs only production dependencies, copies in the compiled `dist/`
and the generated Prisma client, and runs as a non-root user (`nestuser`).

### Environment variables

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development` \| `production` |
| `PORT` | Port the HTTP server listens on (default `3000`) |
| `API_PREFIX` | Global route prefix (default `v1`); `/health` is excluded from it |
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `REDIS_URL` | Redis connection string (Upstash) |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRY` | Access token signing secret / expiry |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRY` | Refresh token signing secret / expiry |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `S3_BUCKET_NAME` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `CDN_BASE_URL` | File storage |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Outbound email |
| `WHATSAPP_API_KEY` / `SMS_API_KEY` | Guest invite channels |
| `FCM_SERVER_KEY` | Push notifications |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Rate limiting window (seconds) / request limit |

See [`.env.example`](.env.example) for the full, up-to-date list.

### CI/CD pipeline

Defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), triggered on pushes and pull requests to `main`:

- **lint** — `npm run lint`
- **test** — `npm run test`, using `DATABASE_URL`/`REDIS_URL` from GitHub Secrets
- **build** — runs after `lint` and `test` pass; `npm run build`, uploads `dist/` as a build artifact (7-day retention)
- **deploy** — runs after `build`, only on a push to `main` (not on PRs); calls the Render deploy hook via `curl`

Concurrent runs on the same branch cancel the older one in favor of the latest push.

### Health check

```bash
curl http://localhost:3000/health
```

Backed by `@nestjs/terminus`, checking PostgreSQL (via Prisma) and Redis connectivity. Returns HTTP 200 when both are up, HTTP 503 if either is down.

### GitHub Secrets required

- `DATABASE_URL`
- `REDIS_URL`
- `RENDER_DEPLOY_HOOK_URL`

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
