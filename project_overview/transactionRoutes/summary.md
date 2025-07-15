# Transaction Routes Overview

## /pay (Add Transaction with Media Upload)

```mermaid
sequenceDiagram
    participant Client
    participant ExpressRoute
    participant Multer
    participant S3Util
    participant S3
    participant Controller
    participant MongoDB

    Client->>ExpressRoute: POST /pay (with form data + mediaFile)
    ExpressRoute->>Multer: Parse multipart/form-data
    Multer->>ExpressRoute: req.file (buffer, mimetype, etc.)
    ExpressRoute->>S3Util: uploadFileToS3({buffer, key, mimetype})
    S3Util->>S3: Upload file
    S3-->>S3Util: S3 URL
    S3Util-->>ExpressRoute: S3 URL
    ExpressRoute->>Controller: createNewTransaction(..., mediaFileUrl)
    Controller->>MongoDB: Save transaction (with mediaFileUrl)
    MongoDB-->>Controller: Transaction saved
    Controller-->>ExpressRoute: Transaction object
    ExpressRoute-->>Client: Response (with mediaFileUrl)
```

**Description:**
- Handles transaction creation and optional media file upload to S3.
- Stores the S3 file URL in the transaction document. 