// ADR-019 / T-077: a tiny local stub of the GitHub REST API, used only by authenticated E2E runs (playwright.config.ts
// starts this as a second webServer). No dependencies. Requests must carry `authorization: Bearer <E2E_GITHUB_TOKEN>`
// or get a 401, same as the real API would refuse a bad token. Response bodies include an obviously fake "SECRET"
// marker in fields the app never stores (description, PR titles, release body) so the E2E spec can assert it never
// reaches a page the app renders.

import http from "node:http";

const PORT = Number(process.env.GITHUB_STUB_PORT || 4010);
const TOKEN = process.env.E2E_GITHUB_TOKEN || "";
const SECRET = "SECRET-github-stub-must-never-leak-83f2ac";
const DAY_MS = 24 * 60 * 60 * 1000;

function send(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(data);
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

// { owner, repo } -> handlers keyed by repo full name, keeping the request handler itself simple.
const repos = {
  "e2e/ok": {
    repository: { default_branch: "main", pushed_at: "2024-01-15T10:00:00Z", open_issues_count: 9, description: `Stub repository for T-077. ${SECRET}` },
    pulls: { body: [{ title: `Stub open pull request. ${SECRET}` }], link: '<http://localhost/repos/e2e/ok/pulls?state=open&per_page=1&page=4>; rel="last"' },
    release: { tag_name: "v2.0.0", published_at: "2024-02-01T00:00:00Z", body: `Stub release notes. ${SECRET}` },
  },
  "e2e/quiet": {
    // Computed per request so the 90-day gap holds however long the test run takes.
    repository: () => ({ default_branch: "main", pushed_at: daysAgoIso(90), open_issues_count: 0, description: `Quiet stub repository. ${SECRET}` }),
    pulls: { body: [] },
    release: null,
  },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Unauthenticated health check only, used by Playwright's webServer readiness poll.
  if (url.pathname === "/" || url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }

  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    return send(res, 401, { message: "Bad credentials" });
  }

  const match = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (!match) return send(res, 404, { message: "Not Found" });
  const [, owner, repoName, rest = ""] = match;
  const fullName = `${owner}/${repoName}`;

  if (fullName === "e2e/missing") return send(res, 404, { message: "Not Found", description: SECRET });
  if (fullName === "e2e/limited") return send(res, 403, { message: "API rate limit exceeded", description: SECRET }, { "x-ratelimit-remaining": "0" });

  const stub = repos[fullName];
  if (!stub) return send(res, 404, { message: "Not Found" });

  if (rest === "" || rest === "/") {
    const repository = typeof stub.repository === "function" ? stub.repository() : stub.repository;
    return send(res, 200, repository);
  }
  if (rest.startsWith("/pulls")) {
    const headers = stub.pulls.link ? { link: stub.pulls.link } : {};
    return send(res, 200, stub.pulls.body, headers);
  }
  if (rest.startsWith("/releases/latest")) {
    if (!stub.release) return send(res, 404, { message: "Not Found" });
    return send(res, 200, stub.release);
  }
  return send(res, 404, { message: "Not Found" });
});

server.listen(PORT, () => {
  console.log(`github-stub listening on ${PORT}`);
});
