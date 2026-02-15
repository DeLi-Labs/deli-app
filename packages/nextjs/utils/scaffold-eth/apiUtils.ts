import { getErrorStatusCode } from "./errors";
import formidable from "formidable";
import { IncomingMessage } from "http";
import type { NextApiResponse } from "next";
import { CampaignUploadFormData, UploadFormData } from "~~/types/liquidip";

type ParseResult = { success: true; data: UploadFormData } | { success: false; error: string };

type CampaignParseResult = { success: true; data: CampaignUploadFormData } | { success: false; error: string };

/**
 * Extracts a single value from formidable fields (handles both single values and arrays)
 */
const getFieldValue = (field: formidable.Fields[string] | undefined): string | undefined => {
  if (!field) return undefined;
  return Array.isArray(field) ? field[0] : field;
};

/**
 * Extracts a single file from formidable files (handles both single files and arrays)
 */
const getFile = (file: formidable.Files[string] | undefined): formidable.File | undefined => {
  if (!file) return undefined;
  return Array.isArray(file) ? file[0] : file;
};

/**
 * Parses attachments from form fields and files
 */
const parseAttachments = (fields: formidable.Fields, files: formidable.Files): UploadFormData["attachments"] => {
  const attachments: UploadFormData["attachments"] = [];
  let index = 0;

  while (true) {
    const fileKey = `attachments[${index}]`;
    const nameKey = `attachments[${index}].name`;
    const descriptionKey = `attachments[${index}].description`;
    const typeKey = `attachments[${index}].type`;

    const file = getFile(files[fileKey]);
    const name = getFieldValue(fields[nameKey]);
    const description = getFieldValue(fields[descriptionKey]);
    const type = getFieldValue(fields[typeKey]) as "ENCRYPTED" | "PLAIN" | undefined;

    if (!file) {
      break; // No more attachments
    }

    if (name && description && type && (type === "ENCRYPTED" || type === "PLAIN")) {
      attachments.push({
        file,
        name,
        description,
        type,
      });
    }

    index++;
  }

  return attachments;
};

/**
 * Parses multipart/form-data request into UploadFormData
 *
 * @param req - Incoming HTTP request
 * @returns ParseResult with either success and data, or error message
 */
export const parseFormData = async (req: IncomingMessage): Promise<ParseResult> => {
  try {
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);

    // Extract and validate required fields
    const name = getFieldValue(fields.name);
    const description = getFieldValue(fields.description);
    const externalUrl = getFieldValue(fields.externalUrl);

    if (!name || !description) {
      return { success: false, error: "Name and description are required" };
    }

    // Extract and validate image file
    const imageFile = getFile(files.image);
    if (!imageFile) {
      return { success: false, error: "Image file is required" };
    }

    // Parse attachments
    const attachments = parseAttachments(fields, files);

    const formData: UploadFormData = {
      name,
      description,
      image: imageFile,
      externalUrl,
      attachments,
    };

    return { success: true, data: formData };
  } catch (error) {
    console.error("Error parsing form data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse form data",
    };
  }
};

/**
 * Extract domain from request headers or environment
 */
export function getExpectedDomain(req: IncomingMessage): string {
  return process.env.SIWE_DOMAIN || (req.headers.host ? new URL(`http://${req.headers.host}`).hostname : "localhost");
}

/**
 * Parses form data for campaign metadata upload
 *
 * @param req - Incoming HTTP request
 * @returns CampaignParseResult with either success and data, or error message
 */
export const parseCampaignFormData = async (req: IncomingMessage): Promise<CampaignParseResult> => {
  try {
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB
      keepExtensions: true,
    });

    const [fields] = await form.parse(req);

    // Extract and validate denomination unit
    const denominationUnit = getFieldValue(fields.denominationUnit) as
      | CampaignUploadFormData["denominationUnit"]
      | undefined;
    const validUnits: CampaignUploadFormData["denominationUnit"][] = [
      "PER_ITEM",
      "PER_HOUR",
      "PER_DAY",
      "PER_BYTE",
      "PER_1000_TOKEN",
    ];

    if (!denominationUnit || !validUnits.includes(denominationUnit)) {
      return {
        success: false,
        error: `Denomination unit is required and must be one of: ${validUnits.join(", ")}`,
      };
    }

    // Extract and validate denomination amount
    const denominationAmountStr = getFieldValue(fields.denominationAmount);
    if (!denominationAmountStr) {
      return { success: false, error: "Denomination amount is required" };
    }

    const denominationAmount = parseFloat(denominationAmountStr);
    if (isNaN(denominationAmount) || denominationAmount <= 0) {
      return { success: false, error: "Denomination amount must be a positive number" };
    }

    const formData: CampaignUploadFormData = {
      denominationUnit,
      denominationAmount,
    };

    return { success: true, data: formData };
  } catch (error) {
    console.error("Error parsing campaign form data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse campaign form data",
    };
  }
};

/**
 * Handle error and return appropriate HTTP response for attachment endpoints
 */
export function handleAttachmentError(error: unknown, res: NextApiResponse): NextApiResponse | void {
  if (!(error instanceof Error)) {
    return res.status(500).json({ error: "Failed to fetch attachment" });
  }

  const statusCode = getErrorStatusCode(error);
  const message = error.message || "An error occurred";

  if (statusCode >= 500) {
    console.error("Error fetching attachment:", error);
  }

  return res.status(statusCode).json({ error: message });
}
