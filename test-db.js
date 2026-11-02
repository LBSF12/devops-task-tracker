const pool = require("./db");

async function testConnection() {
  try {
    const result = await pool.query(
      "SELECT current_user, current_database(), NOW()"
    );

    console.log("Database connection successful!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();