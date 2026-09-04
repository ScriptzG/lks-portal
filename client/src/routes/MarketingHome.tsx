// The LKS Systems marketing site itself, shown at the app's own root — the public-facing home
// page a real visitor lands on, with its own "Client Login" link (already built into the site's
// footer) leading into the actual portal at /login. Backed by the public, unauthenticated
// `GET /api/websites/:id/site` route (server/src/routes/websites.ts), proxied through Vite's
// existing /api proxy so it loads on this same origin.
//
// Hardcoded to the one company record that represents LKS Systems' own site — there's exactly
// one "home page" for this whole product, so this isn't meant to be a generic multi-tenant
// lookup. If the site is ever re-uploaded under a different Website record, update this id (or,
// if that starts happening often, promote it to a `Setting` the way brandLogoUrl already is).
const LKS_WEBSITE_ID = "59d228be-8b2d-46b3-8a6a-ac6b66f917f0";

export function MarketingHome() {
  return (
    <iframe
      title="LKS Systems"
      src={`/api/websites/${LKS_WEBSITE_ID}/site`}
      className="h-screen w-full border-0"
    />
  );
}
