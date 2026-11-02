const { mock } = require("node:test");
const pool = require("../db");
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
  const fakeTasks = [
    { id: 1, title: "Learn Node.js", completed: true },
    { id: 2, title: "Learn GitHub Actions", completed: false }
  ];

  const queryMock = mock.method(pool, "query", async () => {
    return { rows: fakeTasks };
  });

  const server = app.listen(0);

  try {
    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/tasks`
    );

    const data = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(data, fakeTasks);
    assert.equal(queryMock.mock.callCount(), 1);
  } finally {
    server.close();
    queryMock.mock.restore();
  }
});
