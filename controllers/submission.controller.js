import { v4 as uuidv4 } from "uuid";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.config.js";
import supabase from "../supabaseClient.js";
import textract from "textract";
import puppeteer from "puppeteer";

const extractText = (fileBuffer, fileExt) =>
  new Promise((resolve, reject) => {
    const mimeType =
      fileExt === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    textract.fromBufferWithMime(mimeType, fileBuffer, (err, text) => {
      if (err) return reject(err);
      resolve(text || "");
    });
  });

// Function to split text into pages with preserved formatting
const splitTextIntoPages = (text, maxLinesPerPage = 40) => {
  const lines = text.split("\n");
  const pages = [];
  let currentPage = [];
  let lineCount = 0;

  for (const line of lines) {
    const wrappedLines = Math.max(1, Math.ceil(line.length / 100));

    if (lineCount + wrappedLines > maxLinesPerPage && currentPage.length > 0) {
      pages.push(currentPage.join("\n"));
      currentPage = [line];
      lineCount = wrappedLines;
    } else {
      currentPage.push(line);
      lineCount += wrappedLines;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.join("\n"));
  }

  return pages;
};

// HTML template for Similarity Report (Pages 1 & 2)
const generateSimilarityHTML = (
  submissionId,
  randomizedFileName,
  uploadDate,
  downloadDate,
  fileSizeKB,
  textPages,
  wordCount,
  charCount,
  totalPages
) => {
  const contentPagesHTML = textPages
    .map((pageContent, index) => {
      const pageNumber = index + 3;
      return `
    <!-- PAGE ${pageNumber}: CONTENT PAGE -->
    <div
      style="
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        ${pageNumber < totalPages ? "page-break-after: always;" : ""}
      "
    >
      <!-- Header -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
          margin-bottom: 20px;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px">Page ${pageNumber} of ${totalPages} · Integrity Submission</span>
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>

      <!-- Main Content -->
      <div style="flex: 1; padding: 0 40px">
        <pre style="
          white-space: pre-wrap;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          margin: 0;
          padding: 20px 0;
        ">${pageContent}</pre>
      </div>

      <!-- Footer -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
          margin-top: 20px;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px">Page ${pageNumber} of ${totalPages} · Integrity Submission</span>
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>
    </div>
    `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Turnitin-like Report - Pages 1 & 2</title>
  </head>
  <body
    style="
      font-family: Arial, sans-serif;
      margin: 0;
      font-size: 14px;
      color: #222;
    "
  >
    <!-- PAGE 1: COVER PAGE -->
    <div
      style="
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        page-break-after: always;
      "
    >
      <!-- Header -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
          margin-bottom: 25%;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px">Page 1 of ${totalPages} · Cover Page</span>
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>

      <!-- Main Content -->
      <div style="flex: 1; padding: 40px">
        <h1 style="margin-top: 100px; font-size: 22px; font-weight: bold">${randomizedFileName}</h1>
        <div style="margin-top: 10px; font-size: 14px; color: #444">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758990486/e64b50e4-64bc-427c-b3e2-1bb1ee08391f_h5hpkt.png"
            alt=""
            height="80px"
          />
        </div>
        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #ccc" />
        <div
          style="
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-top: 20px;
            gap: 40px;
          "
        >
          <div style="flex: 1; font-size: 14px; line-height: 1.6">
            <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 15px">Document Details</h2>
            <div style="margin-bottom: 12px"><b>Submission ID</b><br/>${submissionId}</div>
            <div style="margin-bottom: 12px"><b>Submission Date</b><br/>${uploadDate}</div>
            <div style="margin-bottom: 12px"><b>Download Date</b><br/>${downloadDate}</div>
            <div style="margin-bottom: 12px"><b>File Name</b><br/>${randomizedFileName}</div>
            <div style="margin-bottom: 12px"><b>File Size</b><br/>${fileSizeKB}</div>
          </div>
          <div
            style="
              background: #f9f9f9;
              padding: 15px 20px;
              font-size: 14px;
              min-width: 150px;
              line-height: 1.6;
            "
          >
            <div style="font-weight: bold">${textPages.length} Page${
    textPages.length > 1 ? "s" : ""
  }</div>
            <div style="font-weight: bold">${wordCount} Words</div>
            <div style="font-weight: bold">${charCount} Characters</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px">Page 1 of ${totalPages} · Cover Page</span>
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>
    </div>

    <!-- PAGE 2: Similarity OVERVIEW -->
    <div
      style="
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        page-break-after: always;
      "
    >
      <!-- Header -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
          margin-bottom: 10px;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px">Page 2 of ${totalPages} · Integrity Overview</span>
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>

      <!-- Main Content -->
      <div style="flex: 1; padding: 40px">
        <h2>0% Overall Similarity</h2>
        <p>The combined total of all matches, including overlapping sources, for each database.</p>
        <h3>Filtered from the Report</h3>
        <ul style="list-style-type: none; padding-left: 15px">
          <li>Bibliography</li>
          <li>Quoted Text</li>
          <li>Cited Text</li>
          <li>Small Matches (less than 5 words)</li>
        </ul>
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0" />
        <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1759635850/ddfd722a-b7c9-4a61-9237-3a4ff08aa754.png" alt="" />
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0" />
        <img src="https://res.cloudinary.com/di3ne2in1/image/upload/v1759636055/cd78d0f1-5ead-4530-8079-b3bc4f01ff95.png" alt="" width="700px" style="margin-top: 5px" />
      </div>

      <!-- Footer -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px">Page 2 of ${totalPages} · Integrity Overview</span>
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>
    </div>

    ${contentPagesHTML}
  </body>
</html>
`;
};

// HTML template for AI Report (Pages 1 & 2)
const generateAIReportHTML = (
  submissionId,
  randomizedFileName,
  uploadDate,
  downloadDate,
  fileSizeKB,
  textPages,
  wordCount,
  charCount,
  totalPages
) => {
  const contentPagesHTML = textPages
    .map((pageContent, index) => {
      const pageNumber = index + 3;
      return `
    <!-- PAGE ${pageNumber}: CONTENT PAGE -->
    <div
      style="
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        ${pageNumber < totalPages ? "page-break-after: always;" : ""}
      "
    >
      <!-- Header -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
          margin-bottom: 20px;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px">Page ${pageNumber} of ${totalPages} · AI Writing Submission</span>
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>

      <!-- Main Content -->
      <div style="flex: 1; padding: 0 40px">
        <pre style="
          white-space: pre-wrap;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          margin: 0;
          padding: 20px 0;
        ">${pageContent}</pre>
      </div>

      <!-- Footer -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
          margin-top: 20px;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px">Page ${pageNumber} of ${totalPages} · AI Writing Submission</span>
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>
    </div>
    `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>AI Writing Report</title>
  </head>
  <body
    style="
      font-family: Arial, sans-serif;
      margin: 0;
      font-size: 14px;
      color: #222;
    "
  >
    <!-- PAGE 1: COVER PAGE -->
    <div
      style="
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        page-break-after: always;
      "
    >
      <!-- Header -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
          margin-bottom: 25%;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px">Page 1 of ${totalPages} · Cover Page</span>
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>

      <!-- Main Content -->
      <div style="flex: 1; padding: 40px">
        <h1 style="margin-top: 100px; font-size: 22px; font-weight: bold">
          ${randomizedFileName}
        </h1>

        <div style="margin-top: 10px; font-size: 14px; color: #444">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758990486/e64b50e4-64bc-427c-b3e2-1bb1ee08391f_h5hpkt.png"
            alt=""
            height="80px"
          />
        </div>

        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #ccc" />

        <div
          style="
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-top: 20px;
            gap: 40px;
          "
        >
          <div style="flex: 1; font-size: 14px; line-height: 1.6">
            <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 15px">
              Document Details
            </h2>

            <div style="margin-bottom: 12px">
              <div style="font-weight: bold">Submission ID</div>
              <div>trn:oid::30744:${submissionId
                .replace(/-/g, "")
                .substring(0, 10)}</div>
            </div>

            <div style="margin-bottom: 12px">
              <div style="font-weight: bold">Submission Date</div>
              <div>${uploadDate}</div>
            </div>

            <div style="margin-bottom: 12px">
              <div style="font-weight: bold">Download Date</div>
              <div>${downloadDate}</div>
            </div>

            <div style="margin-bottom: 12px">
              <div style="font-weight: bold">File Name</div>
              <div>${randomizedFileName}</div>
            </div>

            <div style="margin-bottom: 12px">
              <div style="font-weight: bold">File Size</div>
              <div>${fileSizeKB}</div>
            </div>
          </div>

          <div
            style="
              background: #f9f9f9;
              padding: 15px 20px;
              font-size: 14px;
              min-width: 150px;
              line-height: 1.6;
            "
          >
            <div style="font-weight: bold">${textPages.length} Page${
    textPages.length > 1 ? "s" : ""
  }</div>
            <div style="font-weight: bold">${wordCount} Words</div>
            <div style="font-weight: bold">${charCount} Characters</div>
          </div>
        </div>
      </div>

      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px">Page 1 of ${totalPages} · Cover Page</span>
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>
    </div>

    <!-- PAGE 2: AI WRITING OVERVIEW -->
    <div
      style="
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        page-break-after: always;
      "
    >
      <!-- Header -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
          margin-bottom: 10px;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px"
            >Page 2 of ${totalPages} · AI Writing Overview</span
          >
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>

      <!-- Main Content -->
      <div style="flex: 1; padding: 40px">
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0" />

        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin: 20px 0;
            gap: 30px;
            flex-wrap: wrap;
          "
        >
          <div style="flex: 1; min-width: 250px">
            <h2
              style="margin: 0; font-size: 20px; font-weight: bold; color: #222"
            >
              0% detected as AI
            </h2>
            <p
              style="
                margin: 5px 0 0 0;
                font-size: 10px;
                line-height: 1.5;
                color: #222;
                max-width: 500px;
              "
            >
              The percentage indicates the combined amount of likely
              AI-generated text as well as likely AI-generated text that was
              also likely AI-paraphrased.
            </p>
          </div>

          <div style="flex-shrink: 0">
            <img
              src="https://res.cloudinary.com/di3ne2in1/image/upload/v1759042922/66e9f95a-0ed7-407d-bed5-730e0f8585ca_xlhu1v.jpg"
              alt="caution-box"
              style="width: 280px; height: auto"
            />
          </div>
        </div>

        <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0" />

        <div style="margin-top: 10px; margin-bottom: 10px">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1759044558/e1bed831-7adc-486d-b38e-c58be2b9f53d.png"
            alt=""
          />
        </div>

        <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0" />

        <p
          style="
            font-size: 10px;
            color: #555;
            margin-top: 20px;
            max-width: 750px;
            line-height: 1.5;
          "
        >
          <strong>Disclaimer</strong><br />
          Our AI writing assessment is designed to help educators identify text
          that might be prepared by a generative AI tool. Our AI writing
          assessment may not always be accurate (it may misidentify writings
          that is likely AI generated as AI generated and AI paraphrased or
          likely AI generated and AI paraphrased writings as only AI generated)
          so it should not be used as the sole basis for adverse actions against
          a student. It takes further scrutiny and human judgment in conjunction
          with an organization's application of its specific academic policies
          to determine whether any academic misconduct has occurred.
        </p>

        <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0" />
        <div>
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1759045063/db425bc5-9dea-4f0a-a4c5-5c20941c52ff.png"
            alt=""
          />
        </div>
      </div>

      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          padding: 10px 40px;
        "
      >
        <div style="display: flex; align-items: center">
          <img
            src="https://res.cloudinary.com/di3ne2in1/image/upload/v1758991288/turnitin-tm-logo_slb7le_rra3qh.png"
            alt="Turnitin Logo"
            style="height: 25px; vertical-align: middle"
          />
          <span style="margin-left: 10px"
            >Page 2 of ${totalPages} · AI Writing Overview</span
          >
        </div>
        <div>Submission ID #: ${submissionId}</div>
      </div>
    </div>

    ${contentPagesHTML}
  </body>
</html>
`;
};

export const uploadSubmission = async (req, res) => {
  try {
    const { user_id } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const fileExt = file.originalname.split(".").pop().toLowerCase();
    if (!["pdf", "docx"].includes(fileExt))
      return res
        .status(400)
        .json({ error: "Only PDF and DOCX files are allowed." });

    const randomizedFileName = `tmp${uuidv4().replace(/-/g, "")}.${fileExt}`;
    const submissionId = uuidv4();
    const uploadDate = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Manila",
    });
    const downloadDate = uploadDate;

    const textContent = await extractText(file.buffer, fileExt);
    const words = textContent.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const charCount = textContent.length;
    const textPages = splitTextIntoPages(textContent);
    const totalPages = 2 + textPages.length;
    const fileSizeKB = (file.size / 1024).toFixed(1) + " KB";

    // Upload raw file to Cloudinary
    const uploadFileToCloudinary = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "submissions",
            resource_type: "raw",
            public_id: randomizedFileName.split(".")[0],
          },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        streamifier.createReadStream(file.buffer).pipe(stream);
      });
    const uploadResult = await uploadFileToCloudinary();

    const browser = await puppeteer.launch({ headless: true });

    // Generate Similarity Report
    const similarityHTML = generateSimilarityHTML(
      submissionId,
      randomizedFileName,
      uploadDate,
      downloadDate,
      fileSizeKB,
      textPages,
      wordCount,
      charCount,
      totalPages
    );

    const similarityPage = await browser.newPage();
    await similarityPage.setContent(similarityHTML, {
      waitUntil: "networkidle0",
    });
    const similarityPdfBuffer = await similarityPage.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });
    await similarityPage.close();

    const uploadSimilarityToCloudinary = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "similarity_reports",
            resource_type: "raw",
            public_id: `${submissionId}_similarity_report`,
            format: "pdf",
          },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        streamifier.createReadStream(similarityPdfBuffer).pipe(stream);
      });
    const similarityResult = await uploadSimilarityToCloudinary();

    // Generate AI Report
    const aiReportHTML = generateAIReportHTML(
      submissionId,
      randomizedFileName,
      uploadDate,
      downloadDate,
      fileSizeKB,
      textPages,
      wordCount,
      charCount,
      totalPages
    );

    const aiPage = await browser.newPage();
    await aiPage.setContent(aiReportHTML, { waitUntil: "networkidle0" });
    const aiPdfBuffer = await aiPage.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });
    await aiPage.close();
    await browser.close();

    const uploadAIReportToCloudinary = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "ai_reports",
            resource_type: "raw",
            public_id: `${submissionId}_ai_report`,
            format: "pdf",
          },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        streamifier.createReadStream(aiPdfBuffer).pipe(stream);
      });
    const aiReportResult = await uploadAIReportToCloudinary();

    // Save to database - DAPAT MAY HIWALAY NA FIELD PARA SA AI REPORT
    const { data, error } = await supabase
      .from("submissions")
      .insert([
        {
          id: submissionId,
          user_id,
          file_url: uploadResult.secure_url,
          similarity_url: similarityResult.secure_url,
          ai_url: aiReportResult.secure_url,
          filename: randomizedFileName,
          uploaded_at: uploadDate,
        },
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      submission: data[0],
      similarity_report: similarityResult.secure_url,
      ai_report: aiReportResult.secure_url,
    });
  } catch (err) {
    console.error("❌ Error generating reports:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getRecentSubmissions = async (req, res) => {};
