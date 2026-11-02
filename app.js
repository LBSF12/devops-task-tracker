
const express = require("express");
const pool = require("./db");
const app = express();
const PORT = process.env.PORT || 3000;

// Allow Express to read JSON request bodies
app.use(express.json());

// Application information
app.get("/", (req, res) => {
  res.json({
    application: "DevOps Task Tracker",
    version: "1.0.0",
    message: "Hello from Node.js!"
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Retrieve all tasks
app.get("/tasks", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, completed FROM tasks ORDER BY id"
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Database query failed:", error.message);

    res.status(500).json({
      error: "Failed to retrieve tasks",
    });
  }
});

// Create a new task

app.post("/tasks", async (req, res) => {
  try {
    const { title } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "Task title is required",
      });
    }

    const result = await pool.query(
      "INSERT INTO tasks (title) VALUES ($1) RETURNING *",
      [title.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to create task:", error.message);

    res.status(500).json({
      error: "Failed to create task",
    });
  }
});

// Update an existing task
app.put("/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { completed } = req.body || {};

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid task ID",
      });
    }

    if (typeof completed !== "boolean") {
      return res.status(400).json({
        error: "Completed must be true or false",
      });
    }

    const result = await pool.query(
      "UPDATE tasks SET completed = $1 WHERE id = $2 RETURNING *",
      [completed, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update task:", error.message);

    res.status(500).json({
      error: "Failed to update task",
    });
  }
});

// Delete a task
app.delete("/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid task ID",
      });
    }

    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json({
      message: "Task deleted successfully",
      task: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to delete task:", error.message);

    res.status(500).json({
      error: "Failed to delete task",
    });
  }
});

// Start the HTTP server
module.exports = app;