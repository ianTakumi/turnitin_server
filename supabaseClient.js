// supabaseClient.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Server-side Supabase client using SERVICE ROLE key
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL, // Supabase URL
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service Role Key (server-only)
);

// Example login function (optional)
export async function login(email, password) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(error.message);
    return null;
  }

  console.log("Logged in:", data);
  return data;
}

// Example logout function (optional)
export async function logout() {
  const { error } = await supabaseAdmin.auth.signOut();
  if (error) console.error(error.message);
  else console.log("Logged out");
}

export default supabaseAdmin;
