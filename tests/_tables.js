// Tests that mock single tables (`**/rest/v1/posts*` …) need the site to read them one by one:
// the start-up bundle (rpc/site_data, src/lib/siteData.js) is blocked, so the store falls back
// to its per-table queries — which also keeps that fallback path under test.
export const perTableData = (page) => page.route("**/rest/v1/rpc/site_data*", (route) => route.fulfill({ json: null }));
