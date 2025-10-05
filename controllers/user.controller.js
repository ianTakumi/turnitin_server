import supabaseAdmin from "../supabaseClient.js";
import bcrypt from "bcrypt";

// Get all users
export const getUsers = async (req, res) => {
  const { data, error } = await supabaseAdmin.from("users").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json(data);
};

// Create user
export const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm email
      user_metadata: { name }, // pwede ilagay yung name sa metadata
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // 2. Return created user info
    res.status(201).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
