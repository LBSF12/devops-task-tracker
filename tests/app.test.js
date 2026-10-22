
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");

test("GET /health returns healthy status", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/health`
    );

    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.status, "healthy");
  } finally {
    server.close();
  }
});

test("GET /tasks returns a list", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/tasks`
    );

    const data = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(data));
  } finally {
    server.close();
  }
});
