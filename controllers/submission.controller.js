import supabase from "../supabaseClient.js";
import upload from "../middlewares/multerMiddleware.js";
import cloudinary from "../config/cloudinary.config.js";

// Get recent submissions
export const getRecentSubmissions = async (req, res) => {};

// Upload Submission
export const uploadSubmission = async (req, res) => {
  try {
    const { user_id } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload to Cloudinary with resource_type: "raw" (for docs, zip, pdf, etc.)
    const cloudinaryUpload = new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "submissions",
          resource_type: "raw", // ✅ this allows docx, pdf, zip, etc.
          public_id: file.originalname.split(".")[0], // optional: filename without extension
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(file.buffer);
    });

    const uploadResult = await cloudinaryUpload;

    // Save metadata in Supabase
    const { data, error } = await supabase
      .from("submissions")
      .insert([
        {
          user_id,
          file_url: uploadResult.secure_url,
          filename: file.originalname,
        },
      ])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({ submission: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
