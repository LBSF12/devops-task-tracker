
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Allow Express to read JSON request bodies
app.use(express.json());

// Temporary in-memory task storage
const tasks = [
  { id: 1, title: "Learn Node.js", completed: true },
  { id: 2, title: "Learn GitHub Actions", completed: false }
];

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
app.get("/tasks", (req, res) => {
  res.json(tasks);
});

// Create a new task
app.post("/tasks", (req, res) => {
  const { title } = req.body;

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({
      error: "A non-empty task title is required"
    });
  }

  const newTask = {
    id: tasks.length + 1,
    title: title.trim(),
    completed: false
  };

  tasks.push(newTask);

  res.status(201).json(newTask);
});

// Start the HTTP server
module.exports = app;