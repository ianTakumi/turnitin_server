import supabase from "../supabaseClient";

export const getUsers = async (req, res) => {
  const { data, error } = await supabase.from("users").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json(data);
};

export const createUser = async (req, res) => {
  const { name, email, password } = req.body;
  const { data, error } = await supabase
    .from("users")
    .insert([{ name, email }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
};

export const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(error.message);
    return;
  }
};
