// Wido Timer — configuration.
//
// The extension reads your ALREADY-LOGGED-IN Wido session straight from an open
// Wido tab (no separate login). It talks to Supabase with that session's token.
// The anon key is safe to ship (Row-Level Security protects the data).
export const SUPABASE_URL = "https://uxknhteklotswemtyvur.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_K59XbhnKLSq77tVUysBuTw_qCjMbVP4";

// Project ref — used to locate the Supabase auth token in Wido's localStorage.
export const SUPABASE_PROJECT_REF = "uxknhteklotswemtyvur";

// 👉 Set this to YOUR Wido URL. It's the page the extension opens (in the
// background, then closes) when it needs your session and no Wido tab is open.
// Use your production URL if you have one, e.g. "https://wido.vercel.app/".
export const WIDO_OPEN_URL = "https://wido-theta.vercel.app/";
