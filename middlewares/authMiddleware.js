import supabase from "../supabaseClient.js";

export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ error: "No token provided" });

  const { data, error } = await supabase.auth.getUser(token);

  if (error) return res.status(401).json({ error: error.message });

  req.user = data.user;
  next();
};
