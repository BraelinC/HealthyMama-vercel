import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Load environment variables from .env file BEFORE any other imports that use them
// Look for .env in parent directory (project root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
console.log('🔍 [ENV DEBUG] Looking for .env at:', envPath);
console.log('🔍 [ENV DEBUG] File exists:', fs.existsSync(envPath));
const result = dotenv.config({ path: envPath });
console.log('🔍 [ENV DEBUG] dotenv result:', result.error ? result.error.message : 'success');
console.log('🔍 [ENV DEBUG] DATABASE_URL loaded:', !!process.env.DATABASE_URL);



import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { exec } from "child_process";
import { passport } from "./googleAuth";

const app = express();

// Configure CORS to allow requests from Whop and development environments
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      /^https:\/\/.*\.apps\.whop\.com$/,  // Any Whop app subdomain
      /^https:\/\/whop\.com$/,             // Main Whop domain
      /^http:\/\/localhost:\d+$/,          // Local development
      /^https:\/\/.*\.replit\.dev$/,       // Replit domains
      /^https:\/\/.*\.repl\.co$/           // Replit alternative domains
    ];
    
    // Check if the origin matches any allowed pattern
    const allowed = allowedOrigins.some(pattern => 
      pattern.test(origin)
    );
    
    if (allowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true, // Allow cookies and authentication
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['set-cookie'],
  maxAge: 86400 // Cache preflight response for 24 hours
};

app.use(cors(corsOptions));

// Replit Auth enabled
// Increase payload size limit for image uploads (10MB)
// Skip JSON parsing for Stripe webhook (it needs raw body)
app.use((req, res, next) => {
  if (req.path === '/api/stripe/webhook') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Configure session middleware (required for passport and fallback auth)
app.use(session({
  secret: process.env.SESSION_SECRET || "healthy-mama-session-secret-2025",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for better persistence
    sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax', // 'none' for cross-site in production
    domain: process.env.NODE_ENV === "production" ? undefined : undefined // Let browser handle domain
  },
  name: 'healthy-mama-session', // Custom session name
  rolling: true, // Reset expiry on activity
  proxy: true // Trust proxy for secure cookies behind reverse proxy
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log('🔧 [SERVER DEBUG] Registering API routes...');
  const server = await registerRoutes(app);
  console.log('✅ [SERVER DEBUG] API routes registered successfully');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    console.log('🔧 [SERVER DEBUG] Setting up Vite development middleware...');
    await setupVite(app, server);
  } else {
    console.log('🔧 [SERVER DEBUG] Setting up static file serving...');
    serveStatic(app);
    console.log('✅ [SERVER DEBUG] Static file serving configured');
  }

  // Use PORT env variable or default to 5000
  // this serves both the API and the client.
  // In Replit, port 5000 is the only port that is not firewalled.
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use. Exiting...`);
      process.exit(1);
    } else {
      log(`Server error: ${error.message}`);
      throw error;
    }
  });
  
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    

  });
})();
