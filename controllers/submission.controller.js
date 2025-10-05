import { v4 as uuidv4 } from "uuid";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.config.js";
import supabase from "../supabaseClient.js";
import textract from "textract";
import puppeteer from "puppeteer";
import axios from "axios";

export const uploadSubmission = async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
        code: "MISSING_FILE",
      });
    }

    // Generate unique submission ID
    const submissionId = uuidv4();
    const submissionDate = new Date();

    // Upload file to Cloudinary
    const fileUploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "auto",
          folder: "submissions",
          public_id: `submission_${Date.now()}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });

    // Extract text from file
    const extractedText = await new Promise((resolve, reject) => {
      textract.fromBufferWithMime(
        req.file.mimetype,
        req.file.buffer,
        (error, text) => {
          if (error) reject(error);
          else resolve(text || "");
        }
      );
    });

    // Calculate document metrics
    const wordCount = extractedText
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    const characterCount = extractedText.replace(/\s/g, "").length;
    const pageCount = Math.max(1, Math.ceil(wordCount / 500)); // Increased words per page

    // Generate reports
    const similarityReportUrl = await generateSimilarityReport({
      submissionId,
      filename: req.file.originalname,
      fileSize: (req.file.size / 1024).toFixed(1),
      submissionDate,
      pageCount,
      wordCount,
      characterCount,
      content: extractedText,
    });

    const aiReportUrl = await generateAIReport({
      submissionId,
      filename: req.file.originalname,
      fileSize: (req.file.size / 1024).toFixed(1),
      submissionDate,
      pageCount,
      wordCount,
      characterCount,
      content: extractedText,
    });

    // Store in Supabase
    const { error: dbError } = await supabase.from("submissions").insert({
      id: submissionId,
      filename: req.file.originalname,
      file_url: fileUploadResult.secure_url,
      similarity_url: similarityReportUrl,
      user_id: user_id,
      ai_url: aiReportUrl,
      created_at: submissionDate.toISOString(),
    });

    if (dbError) throw dbError;

    return res.status(201).json({
      submissionId,
      message: "Submission processed successfully",
      reports: {
        similarity: similarityReportUrl,
        ai: aiReportUrl,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      error: "Failed to process submission",
      code: "PROCESSING_ERROR",
    });
  }
};

// Format date without timezone issues
function formatDate(date) {
  return (
    date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + " GMT+3"
  );
}

// Split content into pages for PDF - optimized for space
function splitContentIntoPages(content, wordsPerPage = 500) {
  const words = content.split(/\s+/);
  const pages = [];

  for (let i = 0; i < words.length; i += wordsPerPage) {
    const pageWords = words.slice(i, i + wordsPerPage);
    pages.push(pageWords.join(" "));
  }

  return pages;
}

// Generate Similarity Report
async function generateSimilarityReport(submissionData) {
  const contentPages = splitContentIntoPages(submissionData.content);
  const totalPages = 2 + contentPages.length;

  let htmlContent = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Similarity Report - ${submissionData.filename}</title>
    <style>
      body { 
        font-family: Arial, sans-serif; 
        margin: 0; 
        font-size: 12px; 
        color: #222; 
        line-height: 1.4;
      }
      .page { 
        display: flex; 
        flex-direction: column; 
        min-height: 100vh; 
        page-break-after: always;
        padding: 0;
      }
      .header, .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 7px;
        padding: 5px 20px;
        background: #f8f8f8;
      }
      .main-content {
        flex: 1;
        padding: 20px;
      }
      .content-area {
        white-space: pre-wrap;
        font-family: Arial, sans-serif;
        font-size: 11px;
        line-height: 1.3;
        text-align: justify;
      }
      .compact-section {
        margin: 10px 0;
      }
    </style>
  </head>
  <body>
    <!-- PAGE 1: COVER PAGE -->
    <div class="page">
      <div class="header">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page 1 of ${totalPages} · Cover Page</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>

      <div class="main-content" style="padding: 30px">
        <!-- Filename -->
        <h1 style="margin-top: 50px; font-size: 18px; font-weight: bold">${
          submissionData.filename
        }</h1>

        <!-- Metadata -->
        <div style="margin-top: 8px; font-size: 12px; color: #444">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758990486/e64b50e4-64bc-427c-b3e2-1bb1ee08391f_h5hpkt.png" alt="" height="60px" />
        </div>

        <hr style="margin: 20px 0; border: 0; border-top: 1px solid #ccc" />

        <!-- Document Details + Stats Box -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-top: 15px; gap: 30px;">
          <!-- Document Details -->
          <div style="flex: 1; font-size: 12px; line-height: 1.4">
            <h2 style="font-size: 14px; font-weight: bold; margin-bottom: 10px">Document Details</h2>
            <div style="margin-bottom: 8px">
              <div style="font-weight: bold">Submission ID</div>
              <div>${submissionData.submissionId}</div>
            </div>
            <div style="margin-bottom: 8px">
              <div style="font-weight: bold">Submission Date</div>
              <div>${formatDate(submissionData.submissionDate)}</div>
            </div>
            <div style="margin-bottom: 8px">
              <div style="font-weight: bold">File Name</div>
              <div>${submissionData.filename}</div>
            </div>
            <div style="margin-bottom: 8px">
              <div style="font-weight: bold">File Size</div>
              <div>${submissionData.fileSize} KB</div>
            </div>
          </div>

          <!-- Stats Box -->
          <div style="background: #f9f9f9; padding: 12px 15px; font-size: 12px; min-width: 120px; line-height: 1.4;">
            <div style="font-weight: bold">${submissionData.pageCount} Page${
    submissionData.pageCount > 1 ? "s" : ""
  }</div>
            <div style="font-weight: bold">${
              submissionData.wordCount
            } Words</div>
            <div style="font-weight: bold">${
              submissionData.characterCount
            } Characters</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page 1 of ${totalPages} · Cover Page</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>
    </div>

    <!-- PAGE 2: Similarity OVERVIEW -->
    <div class="page">
      <div class="header">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page 2 of ${totalPages} · Integrity Overview</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>

      <div class="main-content">
        <!-- Similarity Overview Section -->
        <div class="compact-section">
          <h2 style="margin: 0; font-size: 16px; font-weight: bold; color: #222">1% Overall Similarity</h2>
          <p style="margin: 3px 0 0 0; font-size: 9px; line-height: 1.3; color: #222; max-width: 500px;">
            The combined total of all matches, including overlapping sources, for each database.
          </p>
        </div>

        <!-- Filtered from the report section -->
        <div class="compact-section">
          <h3 style="font-weight: bold; font-size: 12px; margin-bottom: 5px;">Filtered from the Report</h3>
          <ul style="list-style-type: none; padding-left: 12px; margin: 0; font-size: 10px;">
            <li>• Bibliography</li>
            <li>• Quoted Text</li>
            <li>• Cited Text</li>
            <li>• Small Matches (less than 5 words)</li>
          </ul>
        </div>

        <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0" />

        <!-- Match Groups -->
        <div class="compact-section">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1759635850/ddfd722a-b7c9-4a61-9237-3a4ff08aa754.png" alt="" style="max-width: 100%; height: auto;" />
        </div>
        
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0" />

        <!-- Integrity Flags -->
        <div class="compact-section">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1759636055/cd78d0f1-5ead-4530-8079-b3bc4f01ff95.png" alt="" style="max-width: 100%; height: auto;" />
        </div>
      </div>

      <div class="footer">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page 2 of ${totalPages} · Integrity Overview</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>
    </div>`;

  // Add content pages for Similarity Report
  contentPages.forEach((pageContent, index) => {
    const pageNumber = index + 3;
    htmlContent += `
    <!-- PAGE ${pageNumber}: SIMILARITY SUBMISSION CONTENT -->
    <div class="page" ${
      pageNumber < totalPages ? "" : 'style="page-break-after: auto;"'
    }>
      <div class="header">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page ${pageNumber} of ${totalPages} · Similarity Submission</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>

      <div class="main-content" style="padding: 15px 20px;">
        <div class="content-area">
          ${pageContent}
        </div>
      </div>

      <div class="footer">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page ${pageNumber} of ${totalPages} · Similarity Submission</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>
    </div>`;
  });

  htmlContent += `</body></html>`;
  return await generatePDF(
    htmlContent,
    `similarity_${submissionData.submissionId}`
  );
}

// Generate AI Report
async function generateAIReport(submissionData) {
  const contentPages = splitContentIntoPages(submissionData.content);
  const totalPages = 2 + contentPages.length;

  let htmlContent = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>AI Writing Report - ${submissionData.filename}</title>
    <style>
      body { 
        font-family: Arial, sans-serif; 
        margin: 0; 
        font-size: 12px; 
        color: #222; 
        line-height: 1.4;
      }
      .page { 
        display: flex; 
        flex-direction: column; 
        min-height: 100vh; 
        page-break-after: always;
        padding: 0;
      }
      .header, .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 7px;
        padding: 5px 20px;
        background: #f8f8f8;
      }
      .main-content {
        flex: 1;
        padding: 20px;
      }
      .content-area {
        white-space: pre-wrap;
        font-family: Arial, sans-serif;
        font-size: 11px;
        line-height: 1.3;
        text-align: justify;
      }
      .compact-section {
        margin: 10px 0;
      }
    </style>
  </head>
  <body>
    <!-- PAGE 1: COVER PAGE -->
    <div class="page">
      <div class="header">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page 1 of ${totalPages} · Cover Page</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>

      <div class="main-content" style="padding: 30px">
        <!-- Filename -->
        <h1 style="margin-top: 50px; font-size: 18px; font-weight: bold">${
          submissionData.filename
        }</h1>

        <!-- Metadata -->
        <div style="margin-top: 8px; font-size: 12px; color: #444">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758990486/e64b50e4-64bc-427c-b3e2-1bb1ee08391f_h5hpkt.png" alt="" height="60px" />
        </div>

        <hr style="margin: 20px 0; border: 0; border-top: 1px solid #ccc" />

        <!-- Document Details + Stats Box -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-top: 15px; gap: 30px;">
          <!-- Document Details -->
          <div style="flex: 1; font-size: 12px; line-height: 1.4">
            <h2 style="font-size: 14px; font-weight: bold; margin-bottom: 10px">Document Details</h2>
            <div style="margin-bottom: 8px">
              <div style="font-weight: bold">Submission ID</div>
              <div>${submissionData.submissionId}</div>
            </div>
            <div style="margin-bottom: 8px">
              <div style="font-weight: bold">Submission Date</div>
              <div>${formatDate(submissionData.submissionDate)}</div>
            </div>
            <div style="margin-bottom: 8px">
              <div style="font-weight: bold">File Name</div>
              <div>${submissionData.filename}</div>
            </div>
            <div style="margin-bottom: 8px">
              <div style="font-weight: bold">File Size</div>
              <div>${submissionData.fileSize} KB</div>
            </div>
          </div>

          <!-- Stats Box -->
          <div style="background: #f9f9f9; padding: 12px 15px; font-size: 12px; min-width: 120px; line-height: 1.4;">
            <div style="font-weight: bold">${submissionData.pageCount} Page${
    submissionData.pageCount > 1 ? "s" : ""
  }</div>
            <div style="font-weight: bold">${
              submissionData.wordCount
            } Words</div>
            <div style="font-weight: bold">${
              submissionData.characterCount
            } Characters</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page 1 of ${totalPages} · Cover Page</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>
    </div>

    <!-- PAGE 2: AI WRITING OVERVIEW -->
    <div class="page">
      <div class="header">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page 2 of ${totalPages} · AI Writing Overview</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>

      <div class="main-content">
        <!-- AI Detection Overview Section -->
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0" />

        <div class="compact-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap;">
          <!-- Left side -->
          <div style="flex: 1; min-width: 200px">
            <h2 style="margin: 0; font-size: 16px; font-weight: bold; color: #222">2% detected as AI</h2>
            <p style="margin: 3px 0 0 0; font-size: 9px; line-height: 1.3; color: #222; max-width: 400px;">
              The percentage indicates the combined amount of likely AI-generated text as well as likely AI-generated text that was also likely AI-paraphrased.
            </p>
          </div>

          <!-- Right side (Caution Box) -->
          <div style="flex-shrink: 0">
            <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1759042922/66e9f95a-0ed7-407d-bed5-730e0f8585ca_xlhu1v.jpg" alt="caution-box" style="width: 200px; height: auto" />
          </div>
        </div>

        <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0" />

        <!-- Detection Groups -->
        <div class="compact-section">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1759044558/e1bed831-7adc-486d-b38e-c58be2b9f53d.png" alt="" style="max-width: 100%; height: auto;" />
        </div>

        <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0" />

        <!-- Disclaimer -->
        <div class="compact-section">
          <p style="font-size: 8px; color: #555; margin: 0; line-height: 1.3;">
            <strong>Disclaimer</strong><br />
            Our AI writing assessment is designed to help educators identify text that might be prepared by a generative AI tool. Our AI writing assessment may not always be accurate (it may misidentify writings that is likely AI generated as AI generated and AI paraphrased or likely AI generated and AI paraphrased writings as only AI generated) so it should not be used as the sole basis for adverse actions against a student. It takes further scrutiny and human judgment in conjunction with an organization's application of its specific academic policies to determine whether any academic misconduct has occurred.
          </p>
        </div>

        <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0" />
        
        <!-- FAQs -->
        <div class="compact-section">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1759045063/db425bc5-9dea-4f0a-a4c5-5c20941c52ff.png" alt="" style="max-width: 100%; height: auto;" />
        </div>
      </div>

      <div class="footer">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page 2 of ${totalPages} · AI Writing Overview</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>
    </div>`;

  // Add content pages for AI Report
  contentPages.forEach((pageContent, index) => {
    const pageNumber = index + 3;
    htmlContent += `
    <!-- PAGE ${pageNumber}: AI WRITING SUBMISSION CONTENT -->
    <div class="page" ${
      pageNumber < totalPages ? "" : 'style="page-break-after: auto;"'
    }>
      <div class="header">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page ${pageNumber} of ${totalPages} · AI Writing Submission</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>

      <div class="main-content" style="padding: 15px 20px;">
        <div class="content-area">
          ${pageContent}
        </div>
      </div>

      <div class="footer">
        <div style="display: flex; align-items: center">
          <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png" alt="Turnitin Logo" style="height: 20px; vertical-align: middle" />
          <span style="margin-left: 8px">Page ${pageNumber} of ${totalPages} · AI Writing Submission</span>
        </div>
        <div>Submission ID #: ${submissionData.submissionId}</div>
      </div>
    </div>`;
  });

  htmlContent += `</body></html>`;
  return await generatePDF(htmlContent, `ai_${submissionData.submissionId}`);
}

// Generate PDF from HTML
async function generatePDF(htmlContent, filename) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0.3in",
        right: "0.3in",
        bottom: "0.3in",
        left: "0.3in",
      },
    });

    // Upload PDF to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: "reports",
          public_id: filename,
          format: "pdf",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      streamifier.createReadStream(pdfBuffer).pipe(uploadStream);
    });

    return uploadResult.secure_url;
  } finally {
    await browser.close();
  }
}

export const getRecentSubmissions = async (req, res) => {
  try {
    const { id } = req.params; // user_id from URL

    if (!id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Fetch from Supabase submissions table
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("user_id", id)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching submissions:", error);
      return res.status(500).json({ error: "Failed to fetch submissions" });
    }

    console.log(data);

    // Return the submissions
    res.status(200).json(data);
  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const downloadSubmissionFile = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "Missing file URL" });

    // 🔹 Extract the public_id from the Cloudinary URL
    const match = url.match(/upload\/v\d+\/(.+)\.pdf$/);
    if (!match)
      return res.status(400).json({ error: "Invalid Cloudinary URL" });

    const publicId = match[1]; // e.g. "reports/similarity_a62a3038-26ae-49b5-9879-b129efe3b142"

    // 🔹 Generate a signed URL with attachment flag (for download)
    const signedUrl = cloudinary.url(publicId, {
      resource_type: "raw",
      sign_url: true,
      flags: "attachment", // Force browser download
      format: "pdf",
    });

    // 🔹 Fetch the file using the signed URL
    const response = await axios.get(signedUrl, {
      responseType: "arraybuffer",
    });

    res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
    res.setHeader("Content-Type", "application/pdf");
    res.send(response.data);
  } catch (error) {
    console.error("❌ Error downloading file:", error.message);
    res.status(500).json({ error: "Failed to download file" });
  }
};
