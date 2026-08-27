export function generateCiWorkflow(type: "nextjs" | "node-publish" | "docker" | "python" = "node-publish"): {
  fileName: string;
  yamlContent: string;
} {
  if (type === "node-publish") {
    return {
      fileName: ".github/workflows/publish.yml",
      yamlContent: `name: Publish to NPM
on:
  release:
    types: [created]

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`,
    };
  }

  if (type === "nextjs") {
    return {
      fileName: ".github/workflows/nextjs-ci.yml",
      yamlContent: `name: Next.js CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
`,
    };
  }

  if (type === "docker") {
    return {
      fileName: ".github/workflows/docker-build.yml",
      yamlContent: `name: Docker Build & Test
on:
  push:
    branches: [main]

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Build Docker Compose Stack
        run: docker compose build
`,
    };
  }

  return {
    fileName: ".github/workflows/python-ci.yml",
    yamlContent: `name: Python CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements.txt
      - run: pytest
`,
  };
}
