"use client";

import { useEffect, useRef, useState } from "react";
import { Base64 } from "js-base64";
import type { NextPage } from "next";
import toast from "react-hot-toast";
import { createCipherGateway } from "~~/services/gateway/cipher/CipherGatewayFactory";
import { getAuthToken } from "~~/utils/auth";

type AttachmentType = "ENCRYPTED" | "PLAIN";

type Attachment = {
  name: string;
  type: AttachmentType;
  description: string;
  fileType: string;
  fileSizeBytes: number;
  file: File;
};

type FormData = {
  name: string;
  description: string;
  image: File | null;
  externalUrl: string;
  attachments: Attachment[];
};

const UploadPage: NextPage = () => {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    image: null,
    externalUrl: "",
    attachments: [],
  });

  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [currentAttachment, setCurrentAttachment] = useState<{
    file: File | null;
    description: string;
    type: AttachmentType;
    name: string;
  }>({
    file: null,
    description: "",
    type: "PLAIN",
    name: "",
  });

  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const modalCheckboxRef = useRef<HTMLInputElement>(null);

  // Sync modal checkbox with state
  useEffect(() => {
    if (modalCheckboxRef.current) {
      modalCheckboxRef.current.checked = attachmentModalOpen;
    }
  }, [attachmentModalOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, image: file }));
    }
  };

  const handleAttachmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrentAttachment(prev => ({
        ...prev,
        file,
        name: file.name,
      }));
    }
  };

  const handleAddAttachment = () => {
    if (!currentAttachment.file) {
      alert("Please select a file");
      return;
    }

    const attachment: Attachment = {
      name: currentAttachment.name,
      type: currentAttachment.type,
      description: currentAttachment.description,
      fileType: currentAttachment.file.type || "application/octet-stream",
      fileSizeBytes: currentAttachment.file.size,
      file: currentAttachment.file,
    };

    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, attachment],
    }));

    // Reset modal state
    setCurrentAttachment({
      file: null,
      description: "",
      type: "PLAIN",
      name: "",
    });
    if (attachmentFileInputRef.current) {
      attachmentFileInputRef.current.value = "";
    }
    if (modalCheckboxRef.current) {
      modalCheckboxRef.current.checked = false;
    }
    setAttachmentModalOpen(false);
  };

  const handleRemoveAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.image) {
      toast.error("Please select an image");
      return;
    }

    // Get Google auth token (authenticate if needed)
    let authToken: string | null = null;
    try {
      toast.loading("Authenticating...", { id: "auth" });
      authToken = await getAuthToken();

      if (!authToken) {
        toast.error("Authentication failed. Please try again.", { id: "auth" });
        return;
      }

      toast.success("Authenticated", { id: "auth" });
    } catch (error) {
      console.error("Error during authentication:", error);
      toast.error("Authentication failed. Please try again.", { id: "auth" });
      return;
    }

    // Create FormData object
    const formDataToSend = new FormData();

    // Append text fields
    formDataToSend.append("name", formData.name);
    formDataToSend.append("description", formData.description);
    if (formData.externalUrl) {
      formDataToSend.append("externalUrl", formData.externalUrl);
    }

    // Append image file
    formDataToSend.append("image", formData.image);

    // Encrypt ENCRYPTED-type attachments with Lit Protocol before appending to form
    type ProcessedAttachment = { file: File; name: string; description: string; type: AttachmentType };
    let processedAttachments: ProcessedAttachment[];

    const encryptedCount = formData.attachments.filter(a => a.type === "ENCRYPTED").length;
    if (encryptedCount > 0) {
      try {
        toast.loading(`Encrypting ${encryptedCount} attachment(s) with Lit Protocol...`, { id: "encrypt" });
        const cipherGateway = createCipherGateway();
        processedAttachments = await Promise.all(
          formData.attachments.map(async (attachment): Promise<ProcessedAttachment> => {
            if (attachment.type === "ENCRYPTED") {
              const result = await cipherGateway.encrypt(attachment.file);
              const serialized = result.ciphertext.serialize();
              const blob = new Blob([new Uint8Array(serialized)], {
                type: "application/octet-stream",
              });
              const file = new File([blob], `${attachment.name}.encrypted`, {
                type: "application/octet-stream",
              });
              return { file, name: attachment.name, description: attachment.description, type: attachment.type };
            }
            return {
              file: attachment.file,
              name: attachment.name,
              description: attachment.description,
              type: attachment.type,
            };
          }),
        );
        toast.success("Encryption complete", { id: "encrypt" });
      } catch (error) {
        console.error("Error encrypting attachments:", error);
        toast.error(error instanceof Error ? error.message : "Failed to encrypt attachments", { id: "encrypt" });
        return;
      }
    } else {
      processedAttachments = formData.attachments.map(a => ({
        file: a.file,
        name: a.name,
        description: a.description,
        type: a.type,
      }));
    }

    // Append attachments with indexed fields
    processedAttachments.forEach((attachment, index) => {
      formDataToSend.append(`attachments[${index}]`, attachment.file);
      formDataToSend.append(`attachments[${index}].name`, attachment.name);
      formDataToSend.append(`attachments[${index}].description`, attachment.description);
      formDataToSend.append(`attachments[${index}].type`, attachment.type);
    });

    try {
      toast.loading("Uploading...", { id: "upload" });

      // Prepare headers with Authorization token
      const headers: HeadersInit = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${Base64.encode(authToken)}`;
      }

      const response = await fetch("/api/ip", {
        method: "POST",
        headers,
        body: formDataToSend,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to upload IP metadata");
      }

      console.log("Upload successful! Metadata URI:", result.uri);
      toast.success(`Upload successful! Metadata URI: ${result.uri}`, { id: "upload" });

      // Reset form
      setFormData({
        name: "",
        description: "",
        image: null,
        externalUrl: "",
        attachments: [],
      });
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading IP metadata:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload IP metadata", { id: "upload" });
    }
  };

  return (
    <div className="flex items-center flex-col grow pt-10 px-5">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-6">Upload IP Metadata</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Name</span>
            </label>
            <input
              type="text"
              placeholder="Name of the IP which will be displayed in the UI"
              className="input input-bordered w-full"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          {/* Description Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              placeholder="Description of the IP covering the technology which will be displayed in the UI"
              className="textarea textarea-bordered w-full"
              rows={4}
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              required
            />
          </div>

          {/* Image Upload */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Image</span>
            </label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="file-input file-input-bordered w-full"
              onChange={handleImageChange}
              required
            />
            {formData.image && (
              <label className="label">
                <span className="label-text-alt text-success">Selected: {formData.image.name}</span>
              </label>
            )}
          </div>

          {/* External URL Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">External URL</span>
            </label>
            <input
              type="url"
              placeholder="Link to IP registration in the official IP registry"
              className="input input-bordered w-full"
              value={formData.externalUrl}
              onChange={e => setFormData(prev => ({ ...prev, externalUrl: e.target.value }))}
            />
          </div>

          {/* Attachments Section */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Attachments</span>
            </label>
            <button
              type="button"
              className="btn btn-outline btn-primary"
              onClick={() => {
                if (modalCheckboxRef.current) {
                  modalCheckboxRef.current.checked = true;
                  setAttachmentModalOpen(true);
                }
              }}
            >
              Add Attachment
            </button>

            {/* Attachments List */}
            {formData.attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {formData.attachments.map((attachment, index) => (
                  <div key={index} className="card bg-base-200 p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold">{attachment.name}</h3>
                        <p className="text-sm text-base-content/70">{attachment.description}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="badge badge-outline">{attachment.type}</span>
                          <span className="badge badge-outline">{(attachment.fileSizeBytes / 1024).toFixed(2)} KB</span>
                          <span className="badge badge-outline">{attachment.fileType}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-circle"
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="form-control w-full mt-8">
            <button type="submit" className="btn btn-primary w-full">
              Submit
            </button>
          </div>
        </form>
      </div>

      {/* Attachment Modal */}
      <input
        type="checkbox"
        id="attachment-modal"
        className="modal-toggle"
        ref={modalCheckboxRef}
        onChange={e => {
          setAttachmentModalOpen(e.target.checked);
          if (!e.target.checked) {
            // Reset form when closing
            setCurrentAttachment({
              file: null,
              description: "",
              type: "PLAIN",
              name: "",
            });
            if (attachmentFileInputRef.current) {
              attachmentFileInputRef.current.value = "";
            }
          }
        }}
      />
      <label htmlFor="attachment-modal" className="modal cursor-pointer">
        <label className="modal-box relative" onClick={e => e.stopPropagation()}>
          <label
            htmlFor="attachment-modal"
            className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3"
            onClick={() => {
              if (modalCheckboxRef.current) {
                modalCheckboxRef.current.checked = false;
              }
              setAttachmentModalOpen(false);
            }}
          >
            ✕
          </label>
          <h3 className="font-bold text-lg mb-4">Add Attachment</h3>

          <div className="space-y-4">
            {/* File Input */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">File</span>
              </label>
              <input
                ref={attachmentFileInputRef}
                type="file"
                className="file-input file-input-bordered w-full"
                onChange={handleAttachmentFileChange}
              />
            </div>

            {/* Name Input */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Name</span>
              </label>
              <input
                type="text"
                placeholder="Name of the attachment"
                className="input input-bordered w-full"
                value={currentAttachment.name}
                onChange={e => setCurrentAttachment(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            {/* Description Input */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <textarea
                placeholder="Description of the attachment"
                className="textarea textarea-bordered w-full"
                rows={3}
                value={currentAttachment.description}
                onChange={e => setCurrentAttachment(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>

            {/* Type Selection */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Type</span>
              </label>
              <div className="flex gap-4">
                <label className="label cursor-pointer gap-2">
                  <input
                    type="radio"
                    name="attachment-type"
                    className="radio radio-primary"
                    checked={currentAttachment.type === "PLAIN"}
                    onChange={() => setCurrentAttachment(prev => ({ ...prev, type: "PLAIN" }))}
                  />
                  <span className="label-text">Plain</span>
                </label>
                <label className="label cursor-pointer gap-2">
                  <input
                    type="radio"
                    name="attachment-type"
                    className="radio radio-primary"
                    checked={currentAttachment.type === "ENCRYPTED"}
                    onChange={() => setCurrentAttachment(prev => ({ ...prev, type: "ENCRYPTED" }))}
                  />
                  <span className="label-text">Encrypted</span>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-action">
              <label
                htmlFor="attachment-modal"
                className="btn btn-ghost"
                onClick={() => {
                  if (modalCheckboxRef.current) {
                    modalCheckboxRef.current.checked = false;
                  }
                  setAttachmentModalOpen(false);
                }}
              >
                Cancel
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleAddAttachment();
                }}
              >
                Add
              </button>
            </div>
          </div>
        </label>
      </label>
    </div>
  );
};

export default UploadPage;
