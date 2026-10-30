import express from "express";
import { config } from "./config.js";
import urlRouter from "./routers/urlRouter.js";
import userAuthRouter from "./routers/userAuthRouter.js";
import protectedRoutes from "./routers/protectedRoutes.js";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

if (config.trustProxy !== false) {
    app.set("trust proxy", config.trustProxy);
}

app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
}));
app.use(helmet({
    contentSecurityPolicy: config.isProduction,
    crossOriginEmbedderPolicy: config.isProduction,
}));
app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

if (!config.isProduction && process.env.SKIP_LOGS !== "true") {
    app.use(morgan("dev"));
}

app.use(urlRouter);

app.use('/api/v1/', userAuthRouter);
app.use('/api/v1/', protectedRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;
