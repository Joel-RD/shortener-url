import os from "os";
import path from "path";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_1234567890";
process.env.STRESS_TEST = "true";
process.env.SKIP_LOGS = "true";
process.env.FRONTEND_ORIGIN = "http://localhost:3000";
process.env.SHORT_URL_BASE = "http://localhost:3000";
process.env.DB_FILE = `file:${path.join(os.tmpdir(), `shortener-url-test-${process.pid}.db`)}`;
