import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

// Initialize GCS client with service account credentials
export const objectStorageClient = (() => {
  try {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.GCS_PROJECT_ID;

    if (!serviceAccountJson || !projectId) {
      console.warn('⚠️ [GCS] Missing credentials - uploads will not work');
      console.warn('⚠️ [GCS] Set GOOGLE_SERVICE_ACCOUNT_JSON and GCS_PROJECT_ID environment variables');
      // Return a basic client that will fail gracefully
      return new Storage();
    }

    const credentials = JSON.parse(serviceAccountJson);
    console.log('✅ [GCS] Initializing with service account for project:', projectId);

    return new Storage({
      credentials,
      projectId,
    });
  } catch (error) {
    console.error('❌ [GCS] Failed to initialize:', error);
    throw new Error('Failed to initialize Google Cloud Storage client');
  }
})();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(contentType?: string): Promise<string> {
    try {
      const privateObjectDir = this.getPrivateObjectDir();
      if (!privateObjectDir) {
        throw new Error(
          "PRIVATE_OBJECT_DIR not set. Set PRIVATE_OBJECT_DIR to your GCS bucket root (e.g., /my-bucket). Uploads are stored under /uploads."
        );
      }

      const objectId = randomUUID();
      const fullPath = `${privateObjectDir}/uploads/${objectId}`;

      console.log(`📤 [GCS] Generating upload URL for: ${fullPath}`);

      const { bucketName, objectName } = parseObjectPath(fullPath);

      // Sign URL for PUT method with 15-minute TTL
      const signedUrl = await signObjectURL({
        bucketName,
        objectName,
        method: "PUT",
        ttlSec: 900,
        contentType,
      });

      console.log(`✅ [GCS] Upload URL generated successfully for object: ${objectId}`);
      return signedUrl;
    } catch (error) {
      console.error('❌ [GCS] Failed to generate upload URL:', error);
      throw error;
    }
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
  
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
  
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
  
    // Extract the entity ID from the path
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Helper method to get the object entity path from upload URL
  getObjectEntityPathFromUploadURL(uploadURL: string): string {
    try {
      const url = new URL(uploadURL);
      const pathParts = url.pathname.split('/');
      const objectName = pathParts[pathParts.length - 1].split('?')[0];
      return `/objects/uploads/${objectName}`;
    } catch (error) {
      console.error('Error parsing upload URL:', error);
      return uploadURL;
    }
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  // Remove leading slash from bucket name if present
  let bucketName = pathParts[1];
  if (bucketName.startsWith("/")) {
    bucketName = bucketName.slice(1);
  }

  const objectName = pathParts.slice(2).join("/");

  console.log(`🪣 [GCS] Parsed path "${path}" -> bucket: "${bucketName}", object: "${objectName}"`);

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
  contentType,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
  contentType?: string;
}): Promise<string> {
  try {
    console.log(`🔗 [GCS] Signing URL for ${method} ${bucketName}/${objectName} (TTL: ${ttlSec}s)`);

    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    // Map HTTP methods to GCS signed URL actions
    const actionMap: Record<string, 'read' | 'write' | 'delete'> = {
      GET: 'read',
      HEAD: 'read',
      PUT: 'write',
      DELETE: 'delete',
    };

    const action = actionMap[method];
    if (!action) {
      throw new Error(`Unsupported HTTP method for signing: ${method}`);
    }

    // Use v2 signing; include contentType if provided to avoid signature mismatch on PUT
    const signOptions: any = {
      version: 'v2',
      action,
      expires: Date.now() + ttlSec * 1000,
    };
    if (contentType && action === 'write') {
      signOptions.contentType = contentType;
    }

    const [signedUrl] = await file.getSignedUrl(signOptions);

    console.log(`✅ [GCS] Successfully generated signed URL for ${bucketName}/${objectName}`);
    return signedUrl;
  } catch (error) {
    console.error(`❌ [GCS] Failed to sign URL for ${bucketName}/${objectName}:`, error);
    throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
