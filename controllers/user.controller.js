import supabase from "../supabaseClient.js";
import bcrypt from "bcrypt";

// Get all users
export const getUsers = async (req, res) => {
  const { data, error } = await supabase.from("users").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json(data);
};

// Create user
export const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Save user with hashed password
    const { data, error } = await supabase
      .from("users")
      .insert([{ name, email, password: hashedPassword }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({ user: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
