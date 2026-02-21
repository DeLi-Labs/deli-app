export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Liquid IP API",
    version: "1.0.0",
    description: "API for IP, campaigns, and attachments.",
  },
  servers: [{ url: "/api", description: "API base" }],
  paths: {
    "/ip": {
      get: {
        summary: "List IPs",
        operationId: "getIpList",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 0 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 10 } },
        ],
        responses: { "200": { description: "Paginated IP list" } },
      },
      post: {
        summary: "Upload IP metadata",
        operationId: "uploadIpMetadata",
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: { type: "object", description: "Form data for IP metadata upload" },
            },
          },
        },
        responses: {
          "200": { description: "Returns { uri }" },
          "4xx": { description: "Returns { error }" },
        },
      },
    },
    "/ip/{tokenId}": {
      get: {
        summary: "Get IP details",
        operationId: "getIpDetails",
        parameters: [{ name: "tokenId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "IP details" } },
      },
    },
    "/campaign": {
      post: {
        summary: "Upload campaign metadata",
        operationId: "uploadCampaignMetadata",
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: { type: "object", description: "Form data for campaign metadata upload" },
            },
          },
        },
        responses: {
          "200": { description: "Returns { uri }" },
          "4xx": { description: "Returns { error }" },
        },
      },
    },
    "/ip/{tokenId}/{campaignId}/prepareAuthorize": {
      post: {
        summary: "Prepare authorize (permit or get tx)",
        operationId: "prepareAuthorize",
        parameters: [
          { name: "tokenId", in: "path", required: true, schema: { type: "integer" } },
          { name: "campaignId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount", "userAddress"],
                properties: {
                  amount: { type: "integer", minimum: 1 },
                  userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  permit: { type: "object", description: "Optional; include when resubmitting with signature" },
                  paymentInfo: { type: "object", description: "Required when permit is provided" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "PrepareAuthorizeResponse (permitMessage or txData)" },
          "400": { description: "Validation or permit error" },
          "404": { description: "Campaign not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/ip/{tokenId}/{campaignId}/quote": {
      post: {
        summary: "Get quote / swap (permit or get tx)",
        operationId: "quote",
        parameters: [
          { name: "tokenId", in: "path", required: true, schema: { type: "integer" } },
          { name: "campaignId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount", "userAddress"],
                properties: {
                  amount: { type: "integer", minimum: 1 },
                  userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  permit: { type: "object", description: "Optional; include when resubmitting with signature" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "QuoteResponse (permitMessage or txData)" },
          "400": { description: "Validation or permit error" },
          "404": { description: "Campaign not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/ip/{tokenId}/{campaignId}/{attachmentId}": {
      get: {
        summary: "Get attachment quote (amount for PER_BYTE campaign)",
        operationId: "getAttachmentQuote",
        parameters: [
          { name: "tokenId", in: "path", required: true, schema: { type: "integer" } },
          { name: "campaignId", in: "path", required: true, schema: { type: "string" } },
          { name: "attachmentId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "Returns { amount }" },
          "400": { description: "Invalid denomination unit" },
          "404": { description: "Campaign not found" },
        },
      },
      post: {
        summary: "Get attachment (plain or gated with payment + SIWE)",
        operationId: "getIpAttachment",
        parameters: [
          { name: "tokenId", in: "path", required: true, schema: { type: "integer" } },
          { name: "campaignId", in: "path", required: true, schema: { type: "string" } },
          { name: "attachmentId", in: "path", required: true, schema: { type: "integer" } },
          { name: "Authorization", in: "header", required: false, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  paymentInfo: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Attachment binary or file" },
          "400": { description: "Payment info required or invalid" },
          "401": { description: "SIWE challenge or auth required" },
          "404": { description: "Campaign not found" },
        },
      },
    },
  },
} as const;
