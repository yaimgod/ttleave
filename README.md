# TTLeave

A self-hosted countdown and event app built with Next.js and Supabase (PostgreSQL, GoTrue Auth, PostgREST, Realtime).

## Quick start (local)

```bash
cp .env.example .env
bash scripts/generate-secrets.sh   # paste output into .env
# Set SUPABASE_PUBLIC_URL, API_EXTERNAL_URL, SITE_URL, NEXT_PUBLIC_* to http://localhost:8001 / http://localhost:3000
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment and local development

For **deploying with self-hosted Coolify** (Docker Compose or GitHub) and **local dev and testing** step by step, see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

- **Coolify + Docker Compose:** use your compose file and set all env vars in Coolify; add domains for the app (port 3000) and API (Kong, port 8001).
- **Coolify + GitHub:** connect the repo, deploy with Docker Compose, set env vars and domains.
- **Local dev:** full stack with `docker compose up`, or backend in Docker + `npm run dev` for hot reload.

## Tech stack

- **Next.js** (App Router), **Supabase** (Postgres, Auth, Realtime), **Kong** (API gateway), **Docker Compose**.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
