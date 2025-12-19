import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import authRouter from "./routes/auth.js";
import productRouter from "./routes/products.js";
import orderRouter from "./routes/orders.js";
import adminRouter from "./routes/admin.js";
import categoriesRouter from "./routes/category.js";

const app = express();

// Middlewares
app.set("trust proxy", true);

// ✅ CORS CONFIGURATION - PLACED AT THE VERY TOP BEFORE ALL ROUTES
// This ensures ALL preflight (OPTIONS) requests are handled correctly with credentials
console.log("🔐 Configuring CORS...");

// CORS middleware with specific origin for credentials support
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

console.log(
  "✅ CORS enabled for http://localhost:5173 with credentials support"
);
console.log("✅ Preflight (OPTIONS) handler registered");

// Security
app.use(helmet());

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log("📝 Morgan logging enabled");
}

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5000,
  });
});

// API Routes - AFTER CORS middleware
console.log("📍 Mounting routes...");
app.use("/api/auth", authRouter);
console.log("✅ Auth routes mounted at /api/auth");

app.use("/api/products", productRouter);
console.log("✅ Product routes mounted at /api/products");

app.use("/api/orders", orderRouter);
console.log("✅ Order routes mounted at /api/orders");

app.use("/api/admin", adminRouter);
console.log("✅ Admin routes mounted at /api/admin");

app.use("/api/categories", categoriesRouter);
console.log("✅ Category routes mounted at /api/categories");

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
