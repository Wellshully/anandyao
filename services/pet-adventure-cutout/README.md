# Pet Adventure ISNet Cutout Service

This service runs the **same ISNet+alpha matting+crop+1024px RGBA** pipeline as the successful `pet_decor_quality_v3_ready.txt`. It requires an external Python host; it is **not** executed inside the Vercel Node.js worker.

## Setup and cost

Cloud Run is an option, **not deployed automatically**. It may charge separately for building, artifact storage, CPU/memory and invocations. Configure billing limits. Use a dedicated strong token (>=32 characters) stored as a secret; never commit it.

Build and deploy this `services/pet-adventure-cutout/` directory as a Cloud Run service (e.g. 2 vCPU, 4Gi, concurrency 1, max instances 1, timeout 120s, min instances 0, region asia-east1). Build uses the Dockerfile and pre-downloads the ISNet model. Consult official Google Cloud Run docs and use Secret Manager for the `CUTOUT_TOKEN` environment variable. The endpoint may be publicly reachable, but calls to `/ready` and `/cutout` require the secret Bearer token. Be mindful of abuse and use request-level limits.

On your Vercel Production environment set:

- `PET_ADVENTURE_CUTOUT_URL=https://YOUR-SERVICE-URL` (the service root, no path)
- `PET_ADVENTURE_CUTOUT_TOKEN=<same strong service token>` (secret)

Do not set `PET_ADVENTURE_AUTO_IMAGES=1` until the service has been deployed and a full manual end-to-end test has passed. The Worker tests cutout readiness **before** claiming the daily image quota for decor. With a working cutout service, the Worker generates Gemini image bytes, sends them to `/cutout`, checks RGBA/alpha coverage and only then uploads the new PNG to Supabase.

## Local test (without calling Gemini or Supabase)

Run the service locally with Docker, configure the same token via an environment variable and use the previously retained original `02-rug-original.jpg` in `~/Pictures/PetAdventureSeed/quality-v3/` as a test fixture. Compare the returned PNG to `02-rug-quality-v3.png` before enabling production.
