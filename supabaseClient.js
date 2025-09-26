// supabaseClient.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

// Login
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(error.message);
    return;
  }

  // JWT is inside data.session.access_token
  console.log("Logged in:", data);
}

// Logout
async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error(error.message);
  else console.log("Logged out");
}

export default supabase;
